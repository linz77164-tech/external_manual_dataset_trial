<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content'

const navigation = inject<Ref<ContentNavigationItem[]>>('navigation')

const { navigationByCategory } = useNavigation(navigation!)
</script>

<template>
  <UMain>
    <UContainer>
      <UPage>
        <template #left>
          <UPageAside>
            <UContentNavigation
              :collapsible="false"
              :navigation="navigationByCategory"
              highlight
              :ui="{
                linkTrailingBadge: 'font-semibold uppercase'
              }"
            />
          </UPageAside>
        </template>

        <slot />
      </UPage>
    </UContainer>
  </UMain>
</template>
