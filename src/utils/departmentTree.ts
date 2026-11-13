import type { DepartmentResponse } from '@/types/system'

export function flattenDepartmentTree(tree: DepartmentResponse[]) {
  const result: DepartmentResponse[] = []
  const visit = (nodes: DepartmentResponse[]) => {
    for (const node of nodes) {
      result.push(node)
      visit(node.children)
    }
  }
  visit(tree)
  return result
}

export function buildDepartmentNameMap(tree: DepartmentResponse[]) {
  const result = new Map<number, string>()
  for (const department of flattenDepartmentTree(tree)) {
    const name = department.departmentName.trim()
    if (name) result.set(department.departmentId, name)
  }
  return result
}

export function resolveDepartmentName(
  departmentId: number | null | undefined,
  snapshotName?: string | null,
  departmentNames: ReadonlyMap<number, string> = new Map(),
) {
  const normalizedSnapshot = snapshotName?.trim()
  if (normalizedSnapshot) return normalizedSnapshot
  if (departmentId === null || departmentId === undefined) return '-'
  return departmentNames.get(departmentId)?.trim() || `部门 ${departmentId}`
}

export function formatDepartmentTooltip(
  departmentId: number | null | undefined,
  snapshotName?: string | null,
  departmentNames: ReadonlyMap<number, string> = new Map(),
) {
  const name = resolveDepartmentName(departmentId, snapshotName, departmentNames)
  if (departmentId === null || departmentId === undefined) return name
  return name === `部门 ${departmentId}` ? name : `${name}（${departmentId}）`
}

export function getDepartmentDescendantIds(tree: DepartmentResponse[], departmentId: number) {
  const target = flattenDepartmentTree(tree).find((item) => item.departmentId === departmentId)
  return target ? flattenDepartmentTree(target.children).map((item) => item.departmentId) : []
}

export function hasSiblingDepartmentName(
  tree: DepartmentResponse[],
  parentId: number | null,
  departmentName: string,
  excludedDepartmentId?: number,
) {
  const normalized = departmentName.trim()
  return flattenDepartmentTree(tree).some(
    (item) =>
      item.departmentId !== excludedDepartmentId &&
      item.parentId === parentId &&
      item.departmentName.trim() === normalized,
  )
}
