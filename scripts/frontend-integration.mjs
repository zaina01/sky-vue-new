import assert from 'node:assert/strict'
import { glob, mkdir, readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

// Reuses the existing integration database. Never runs Gradle reset or SQL migrations.
const base = process.env.SKY_FRONTEND_IT_API || 'http://localhost:18080/api'
if (!/^http:\/\/(localhost|127\.0\.0\.1):18080\/api$/.test(base)) {
  throw new Error(
    'This acceptance script is restricted to the documented local test host on port 18080',
  )
}
const results = []
const cleanup = []
let token
async function request(path, method = 'GET', body, auth = token, expected = 200) {
  const headers = auth ? { Authorization: `Bearer ${auth}` } : {}
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json'
  const response = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  })
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${await (response.status === expected ? Promise.resolve('') : response.clone().text())}`,
  )
  const envelope = await response.json()
  if (expected === 200) assert.equal(envelope.code, 0, `${method} ${path}: ${envelope.msg}`)
  return expected === 200 ? envelope.data : envelope
}
async function check(name, action) {
  try {
    await action()
    results.push({ name, status: 'PASS' })
    console.log(`PASS ${name}`)
  } catch (error) {
    results.push({ name, status: 'FAIL', error: error.message })
    console.error(`FAIL ${name}: ${error.message}`)
    throw error
  }
}
const suffix = Date.now().toString(36)
let installation, foreign, target, admin, group, backup, job, channel, rule, service, permission
const accountBase = () => `/plugins/installations/${installation}/accounts`
const groupBase = () => `/plugins/installations/${installation}/account-groups`
try {
  await check('existing test host and fixtures', async () => {
    token = (
      await request(
        '/user/login',
        'POST',
        { username: 'frontend_it_admin', password: 'FrontendIt!2026' },
        undefined,
      )
    ).token
    admin = await request('/user/me')
    const targetLogin = await request(
      '/user/login',
      'POST',
      { username: 'frontend_it_target', password: 'FrontendIt!2026' },
      undefined,
    )
    target = {
      token: targetLogin.token,
      ...(await request('/user/me', 'GET', undefined, targetLogin.token)),
    }
    const instances = await request('/plugins/installations?page=1&size=100')
    foreign = instances.items.find(
      (item) => item.installationName === 'Frontend IT B',
    ).installationId
    service = instances.items.find(
      (item) => item.pluginId === 'frontend-integration-service',
    ).installationId
    const originalA = instances.items.find(
      (item) => item.installationName === 'Frontend IT A',
    ).installationId
    assert.deepEqual(await request(`/plugins/installations/${originalA}/notification-channels`), [
      'frontend-it-channel-a',
    ])
    assert.deepEqual(await request(`/plugins/installations/${foreign}/notification-channels`), [
      'frontend-it-channel-b',
    ])
    assert.notDeepEqual(
      await request(`/plugins/installations/${originalA}/config`),
      await request(`/plugins/installations/${foreign}/config`),
    )
    assert.equal(
      (await request(`/plugins/installations/${originalA}/accounts?page=1&size=1`)).items[0]
        .accountJson,
      undefined,
    )
    console.log(JSON.stringify({ originalA, foreign, service }))
  })

  await check('disabled department compatibility and local dependency installation', async () => {
    assert.match(
      JSON.stringify(await request('/system/departments')),
      /Frontend IT Legacy Disabled/,
    )
    const roles = await request('/system/roles?roleName=FRONTEND_IT_CUSTOM&page=1&size=20')
    assert.ok(roles.items[0].departmentIds.length)
    const dependencies = await request('/plugins/dependencies/local-artifacts?page=1&size=1')
    assert.ok(dependencies.total >= 1)
    assert.equal(dependencies.items[0].coordinate, 'com.sky.it:frontend-helper:1.0.0')
    await request('/plugins/definitions/frontend-integration/dependencies/install', 'POST', {
      dependencies: [dependencies.items[0].coordinate],
      mode: 'merge',
    })
  })

  await check('group CRUD, name validation and instance isolation', async () => {
    installation = (
      await request('/plugins/installations', 'POST', {
        pluginId: 'frontend-integration',
        installationName: `Frontend UI Acceptance ${suffix}`,
      })
    ).installationId
    cleanup.push(() => request(`/plugins/installations/${installation}`, 'DELETE'))
    group = (await request(groupBase(), 'POST', { name: `  Primary ${suffix}  ` })).groupId
    backup = (await request(groupBase(), 'POST', { name: `Backup ${suffix}` })).groupId
    const groups = await request(groupBase())
    assert.equal(groups[0].name, `Primary ${suffix}`)
    assert.deepEqual(
      groups.map((item) => item.groupId),
      [group, backup],
    )
    assert.equal(
      (await request(groupBase(), 'POST', { name: `primary ${suffix}` }, token, 409)).code,
      409001,
    )
    assert.equal((await request(groupBase(), 'POST', { name: ' ' }, token, 400)).code, 400001)
    await request(`${groupBase()}/${backup}`, 'PUT', { name: `Renamed ${suffix}` })
    assert.equal((await request(groupBase(), 'GET', undefined, target.token, 404)).code, 404001)
    assert.equal(
      (
        await request(
          `/plugins/installations/${foreign}/accounts/a/group`,
          'PATCH',
          { groupId: group },
          token,
          404,
        )
      ).code,
      404001,
    )
  })

  await check('account creation, stable pagination, filters and safe list columns', async () => {
    for (const [accountId, enabled] of [
      ['z-older', true],
      ['a-later', false],
    ]) {
      await request(accountBase(), 'POST', {
        accountId,
        displayName: `Acceptance ${accountId}`,
        enabled,
        groupId: group,
        accountJson: JSON.stringify({
          accountId,
          region: 'east',
          expireAt: '2026-12-31T23:59:59',
          secret: 'acceptance-secret',
        }),
      })
    }
    assert.deepEqual(
      (await request(accountBase() + '?page=1&size=10')).items.map((item) => item.accountId),
      ['z-older', 'a-later'],
    )
    assert.equal((await request(accountBase() + '?page=2&size=1')).items[0].accountId, 'a-later')
    assert.equal((await request(accountBase() + `?groupId=${group}&enabled=false`)).total, 1)
    assert.equal((await request(accountBase() + '?ungrouped=true')).total, 0)
    assert.equal(
      (
        await request(
          accountBase() + `?groupId=${group}&ungrouped=true`,
          'GET',
          undefined,
          token,
          400,
        )
      ).code,
      400001,
    )
    assert.equal((await request(groupBase()))[0].accountCount, 2)
    const preference = await request(accountBase() + '/view-preference')
    assert.equal(preference.maxFields, 5)
    assert.deepEqual(
      preference.availableFields.map((field) => field.name),
      ['region', 'expireAt'],
    )
    await request(accountBase() + '/view-preference', 'PUT', { fields: ['expireAt', 'region'] })
    const item = (await request(accountBase() + '?page=1&size=1')).items[0]
    assert.equal(item.accountJson, undefined)
    assert.equal(item.displayValues.region, 'east')
    assert.ok(!JSON.stringify(item).includes('acceptance-secret'))
    await request(`${accountBase()}/z-older`, 'PUT', {
      accountJson: JSON.stringify({ accountId: 'z-older', region: 'west' }),
    })
    assert.equal((await request(`${accountBase()}/z-older`)).groupId, group)
  })

  await check('single/batch group moves, explicit null and partial receipts', async () => {
    assert.equal(
      (await request(`${accountBase()}/z-older/group`, 'PATCH', {}, token, 400)).code,
      400001,
    )
    await request(`${accountBase()}/z-older/group`, 'PATCH', { groupId: null })
    assert.equal((await request(accountBase() + '?ungrouped=true')).total, 1)
    const result = await request(accountBase() + '/group', 'PATCH', {
      accountIds: ['z-older', 'a-later', 'z-older', 'missing'],
      groupId: group,
    })
    assert.equal(result.succeeded, 2)
    assert.equal(result.failed, 2)
    assert.equal(result.receipts.length, 4)
  })

  await check('CSV/XLSX group export and round-trip import preserve groups and order', async () => {
    for (const format of ['csv', 'xlsx']) {
      const response = await fetch(
        base + accountBase() + `/export?format=${format}&groupId=${group}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      assert.equal(response.status, 200)
      assert.ok(!response.headers.get('content-type').includes('application/json'))
      const blob = await response.blob()
      if (format === 'csv') {
        const csv = await blob.text()
        assert.ok(csv.indexOf('z-older') < csv.indexOf('a-later'))
        assert.ok(!csv.split('\n')[0].includes('group'))
      }
      const file = new FormData()
      file.append('file', blob, `acceptance.${format}`)
      const result = await request(accountBase() + '/import?dryRun=false', 'POST', file)
      assert.equal(result.failedRows, 0)
      assert.equal(result.updatedRows, 2)
      assert.equal((await request(`${accountBase()}/z-older`)).groupId, group)
    }
    const file = new FormData()
    file.append('file', new Blob(['accountId,region,enabled\nimport-new,east,true\n']), 'new.csv')
    assert.equal(
      (await request(accountBase() + '/import?dryRun=false', 'POST', file)).createdRows,
      1,
    )
    assert.equal((await request(`${accountBase()}/import-new`)).groupId, null)
    const error = await fetch(
      base + accountBase() + `/export?format=csv&groupId=${group}&ungrouped=true`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    assert.equal(error.status, 400)
    assert.equal(JSON.parse(await (await error.blob()).text()).code, 400001)
  })

  await check('delete populated group preserves accounts and account JSON', async () => {
    const before = await request(`${accountBase()}/z-older`)
    await request(`${groupBase()}/${group}`, 'DELETE')
    const after = await request(`${accountBase()}/z-older`)
    assert.equal(after.groupId, null)
    assert.equal(after.accountJson, before.accountJson)
    assert.equal(after.createdAt, before.createdAt)
    assert.equal((await request(accountBase() + '?ungrouped=true')).total, 3)
  })

  await check('task channels, notification rules and historical ID snapshots', async () => {
    channel = `frontend-ui-channel-${suffix}`
    await request('/notifications/channels', 'POST', {
      channelId: channel,
      displayName: 'Acceptance local channel',
      channelType: 'WEBHOOK',
      enabled: false,
      configJson: '{"url":"http://127.0.0.1:9/acceptance"}',
    })
    cleanup.push(async () => {
      await request(`/plugins/installations/${installation}/notification-channels`, 'PUT', {
        channelIds: [],
      })
      await request(`/notifications/channels/${channel}`, 'DELETE')
    })
    await request(`/plugins/installations/${installation}/notification-channels`, 'PUT', {
      channelIds: [channel],
    })
    job = (
      await request('/jobs', 'POST', {
        jobName: `Frontend UI Acceptance ${suffix}`,
        pluginInstallationId: installation,
        cronExpression: '0 0 0 1 1 ? 2099',
        misfirePolicy: 'DO_NOTHING',
        inputJson: '{}',
        timeoutMillis: 30000,
        concurrent: false,
        notificationChannelIds: [channel],
        remark: 'Temporary UI acceptance fixture',
      })
    ).id
    cleanup.push(() => request(`/jobs/${job}`, 'DELETE'))
    assert.deepEqual((await request(`/jobs/${job}`)).notificationChannelIds, [channel])
    await request(`/jobs/${job}/notification-channels`, 'PUT', { channelIds: [] })
    assert.deepEqual((await request(`/jobs/${job}`)).notificationChannelIds, [])
    rule = `frontend-ui-rule-${suffix}`
    await request('/notifications/rules', 'POST', {
      ruleId: rule,
      displayName: 'Acceptance rule',
      enabled: false,
      eventType: 'JOB_EXECUTION_SUCCESS',
      pluginInstallationId: installation,
      jobId: String(job),
      severity: 'INFO',
      channelIds: [channel],
      remark: 'Temporary fixture',
    })
    cleanup.push(() => request(`/notifications/rules/${rule}`, 'DELETE'))
    assert.equal((await request(`/notifications/rules/${rule}`)).jobId, String(job))
    const history = await request('/notifications/history?page=1&size=100')
    assert.ok(history.total > 0)
    assert.ok(
      history.items.some(
        (item) => item.sourceOwnerUserId && item.channelOwnerUserId && item.installationId,
      ),
    )
  })

  await check('four ownership transfers immediately apply to the existing SELF token', async () => {
    const body = {
      targetUserId: target.userId,
      pluginInstallationIds: [installation],
      jobIds: [job],
      notificationChannelIds: [channel],
      notificationRuleIds: [rule],
    }
    const transfer = await request('/system/data-ownership/transfer', 'POST', body)
    for (const name of [
      'pluginInstallationsTransferred',
      'jobsTransferred',
      'notificationChannelsTransferred',
      'notificationRulesTransferred',
    ])
      assert.equal(transfer[name], 1)
    assert.equal(
      (await request(`/plugins/installations/${installation}`, 'GET', undefined, target.token))
        .ownerUserId,
      target.userId,
    )
    assert.equal(
      (await request(`/jobs/${job}`, 'GET', undefined, target.token)).ownerUserId,
      target.userId,
    )
    assert.equal(
      (await request(`/notifications/channels/${channel}`, 'GET', undefined, target.token))
        .ownerUserId,
      target.userId,
    )
    assert.equal(
      (await request(`/notifications/rules/${rule}`, 'GET', undefined, target.token)).ownerUserId,
      target.userId,
    )
    assert.equal((await request(groupBase(), 'GET', undefined, target.token))[0].groupId, backup)
    await request('/system/data-ownership/transfer', 'POST', {
      ...body,
      targetUserId: admin.userId,
    })
    assert.equal((await request(groupBase(), 'GET', undefined, target.token, 404)).code, 404001)
  })

  await check('SERVICE permissions CRUD and real runner call/log', async () => {
    permission = await request('/plugin-service/permissions', 'POST', {
      callerInstallationId: installation,
      targetInstallationId: service,
      operation: 'echo',
      enabled: true,
    })
    cleanup.push(async () => {
      if (permission) await request(`/plugin-service/permissions/${permission.id}`, 'DELETE')
    })
    assert.equal((await request(`/plugin-service/permissions/${permission.id}`)).operation, 'echo')
    await request(`/plugin-service/permissions/${permission.id}/enabled`, 'PATCH', {
      enabled: false,
    })
    await request(`/plugin-service/permissions/${permission.id}/enabled`, 'PATCH', {
      enabled: true,
    })
    await request(`/plugin-service/permissions/${permission.id}`, 'DELETE')
    permission = await request('/plugin-service/permissions', 'POST', {
      callerInstallationId: installation,
      targetInstallationId: service,
      operation: 'echo',
      enabled: true,
    })
    const run = await request(`/jobs/${job}/run`, 'POST', {
      inputJson: JSON.stringify({ serviceInstallationId: service }),
      timeoutMillis: 30000,
    })
    let execution
    for (let attempt = 0; attempt < 45; attempt++) {
      execution = await request(`/job-executions/${run.executionId}`)
      if (execution.status !== 'RUNNING') break
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    assert.equal(execution.status, 'SUCCESS', execution.errorMessage)
    const calls = await request(
      `/plugin-service/calls?callerInstallationId=${installation}&targetInstallationId=${service}&operation=echo&page=1&size=20`,
    )
    assert.ok(calls.total >= 1)
    assert.equal(calls.items[0].success, true)
    const detail = await request(`/plugin-service/calls/${calls.items[0].id}`)
    assert.ok(detail.serviceRequestId && detail.responseBytes > 0)
    const logs = await request(`/plugin-service/calls/${detail.id}/logs?tailBytes=65536`)
    assert.equal(logs.exists, true)
    assert.match(logs.content, /frontend integration service/)
  })

  await check('complex JSON cells, row failures and CSV/XLSX round trips', async () => {
    const pluginId = `frontend-ui-account-file-${suffix}`
    const fixtureDir = resolve('node_modules/.cache/frontend-integration/account-file-' + suffix)
    const classesDir = resolve(fixtureDir, 'classes')
    await mkdir(classesDir, { recursive: true })
    const source = (
      await readFile('scripts/fixtures/FrontendAccountFilePlugin.java', 'utf8')
    ).replace('__PLUGIN_ID__', pluginId)
    await writeFile(resolve(fixtureDir, 'FrontendAccountFilePlugin.java'), source)
    const apiJar =
      process.env.SKY_PLUGIN_API_JAR ||
      'D:/Files/java/sky-new/sky-plugin-api/build/libs/sky-plugin-api-1.0-SNAPSHOT.jar'
    execFileSync('javac', [
      '-encoding',
      'UTF-8',
      '-cp',
      apiJar,
      '-d',
      classesDir,
      resolve(fixtureDir, 'FrontendAccountFilePlugin.java'),
    ])
    const jarPath = resolve(fixtureDir, 'accounts.jar')
    execFileSync('jar', ['--create', '--file', jarPath, '-C', classesDir, '.'])
    const artifact = new FormData()
    artifact.append('file', new Blob([await readFile(jarPath)]), 'accounts.jar')
    await request('/plugins/artifacts', 'POST', artifact)
    const instance = (
      await request('/plugins/installations', 'POST', {
        pluginId,
        installationName: `Complex JSON acceptance ${suffix}`,
      })
    ).installationId
    cleanup.push(async () => {
      await request(`/plugins/installations/${instance}`, 'DELETE')
      // Backend uninstall soft-deletes instances; remove only this script's fixture row
      // before deleting its definition, otherwise the retained FK prevents deletion.
      let driverJar = process.env.SKY_MYSQL_DRIVER_JAR
      if (!driverJar) {
        const pattern = `${process.env.USERPROFILE.replaceAll('\\', '/')}/.gradle/caches/modules-2/files-2.1/com.mysql/mysql-connector-j/**/*.jar`
        for await (const jar of glob(pattern)) {
          driverJar = jar
          break
        }
      }
      if (!driverJar)
        throw new Error(
          'Set SKY_MYSQL_DRIVER_JAR to the existing MySQL JDBC driver for fixture cleanup',
        )
      execFileSync('java', [
        '--class-path',
        driverJar,
        'scripts/fixtures/RemoveDeletedAccountFileFixture.java',
        instance,
        pluginId,
      ])
      await request(`/plugins/definitions/${pluginId}`, 'DELETE')
    })
    const path = `/plugins/installations/${instance}/accounts`
    const csvCell = (value) => '"' + String(value).replaceAll('"', '""') + '"'
    const rows = [
      [
        'good',
        '["商品A","商品B"]',
        '["商品A"]',
        '["商品B"]',
        '{"key":"value"}',
        '[{"name":"profile"}]',
        'true',
      ],
      ['blank', '', '', '', '', '', 'true'],
      ['bad-json', '[not-json', '[]', '[]', '{}', '[]', 'true'],
      ['wrong-container', '{}', '[]', '[]', '{}', '[]', 'true'],
    ]
    const csv = [
      'accountId,items,choices,checks,properties,profiles,enabled',
      ...rows.map((row) => row.map(csvCell).join(',')),
    ].join('\n')
    const file = new FormData()
    file.append('file', new Blob([csv]), 'complex.csv')
    const result = await request(path + '/import?dryRun=false', 'POST', file)
    assert.equal(result.successRows, 2)
    assert.equal(result.failedRows, 2)
    assert.ok(
      result.rows
        .filter((row) => row.status === 'FAILED')
        .every((row) => row.rowNumber > 0 && row.message),
    )
    const payload = JSON.parse((await request(path + '/good')).accountJson)
    assert.deepEqual(payload.items, ['商品A', '商品B'])
    assert.deepEqual(payload.properties, { key: 'value' })
    assert.deepEqual(payload.profiles, [{ name: 'profile' }])
    const blank = JSON.parse((await request(path + '/blank')).accountJson)
    assert.deepEqual(blank.items, [])
    assert.deepEqual(blank.properties, {})
    await request(path + '/view-preference', 'PUT', { fields: ['checks', 'choices'] })
    // CHECKBOX file cells keep scalar text behavior; array projections come from account JSON.
    await request(path + '/good', 'PUT', {
      accountJson: JSON.stringify({ ...payload, checks: ['商品B'] }),
    })
    const projected = (await request(path + '?page=1&size=10')).items.find(
      (item) => item.accountId === 'good',
    )
    assert.deepEqual(projected.displayValues.checks, ['商品B'])
    await request(path + '/good', 'PUT', { accountJson: JSON.stringify(payload) })
    for (const format of ['csv', 'xlsx']) {
      const exported = await fetch(base + path + `/export?format=${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      assert.equal(exported.status, 200)
      const roundtrip = new FormData()
      roundtrip.append('file', await exported.blob(), 'complex.' + format)
      assert.equal((await request(path + '/import?dryRun=false', 'POST', roundtrip)).failedRows, 0)
      assert.deepEqual(JSON.parse((await request(path + '/good')).accountJson), payload)
    }
  })

  await check('uniform unknown-route 404', async () => {
    assert.equal(
      (await request('/frontend-ui-acceptance-route-does-not-exist', 'GET', undefined, token, 404))
        .code,
      404001,
    )
  })
} catch {
  process.exitCode = 1
} finally {
  for (const action of cleanup.reverse()) {
    try {
      await action()
    } catch (error) {
      results.push({ name: 'fixture cleanup', status: 'FAIL', error: error.message })
      process.exitCode = 1
    }
  }
  await mkdir('docs', { recursive: true })
  await writeFile(
    'docs/frontend-integration-results.json',
    JSON.stringify(
      { date: new Date().toISOString(), base, database: 'sky_new_frontend_it', results },
      null,
      2,
    ) + '\n',
  )
}
