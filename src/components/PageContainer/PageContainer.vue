<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <section class="page-container">
    <header class="page-container__header">
      <div>
        <h1>{{ title }}</h1>
        <p v-if="description">{{ description }}</p>
      </div>
      <div v-if="$slots.extra" class="page-container__extra">
        <slot name="extra" />
      </div>
    </header>

    <div class="page-container__body">
      <slot />
    </div>
  </section>
</template>
