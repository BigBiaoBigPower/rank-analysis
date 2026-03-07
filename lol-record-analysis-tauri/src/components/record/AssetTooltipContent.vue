<template>
  <div class="asset-tooltip">
    <div class="asset-tooltip-header">
      <img :src="iconSrc" :alt="name" class="asset-tooltip-icon" />
      <div class="asset-tooltip-title">{{ name }}</div>
    </div>
    <div class="asset-tooltip-description">{{ description }}</div>
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  iconSrc: string
  name: string
  description: string
}>()
</script>

<style scoped>
.asset-tooltip {
  max-width: 320px;
}

.asset-tooltip-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

.asset-tooltip-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: 6px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
  object-fit: cover;
}

.asset-tooltip-title {
  min-height: 24px;
  display: flex;
  align-items: center;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.asset-tooltip-description {
  white-space: pre-line;
  line-height: 1.45;
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
