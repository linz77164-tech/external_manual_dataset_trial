<!-- eslint-disable vue/block-tag-newline -->
<script lang="ts">
import type { VNode } from 'vue'
import type { AppConfig } from '@nuxt/schema'
import theme from '#build/ui/breadcrumb'
import type { AvatarProps, IconProps, LinkProps } from '../types'
import type { DynamicSlots, GetItemKeys } from '../types/utils'
import type { ComponentConfig } from '../types/tv'

type Breadcrumb = ComponentConfig<typeof theme, AppConfig, 'breadcrumb'>

export interface BreadcrumbItem extends Omit<LinkProps, 'raw' | 'custom'> {
  label?: string
  /**
   * @IconifyIcon
   */
  icon?: IconProps['name']
  avatar?: AvatarProps
  slot?: string
  class?: any
  ui?: Pick<Breadcrumb['slots'], 'item' | 'link' | 'linkLeadingIcon' | 'linkLeadingAvatar' | 'linkLabel' | 'separator' | 'separatorIcon'>
  [key: string]: any
}

export interface BreadcrumbProps<T extends BreadcrumbItem = BreadcrumbItem> {
  /**
   * The element or component this component should render as.
   * @defaultValue 'nav'
   */
  as?: any
  items?: T[]
  /**
   * The icon to use as a separator.
   * @defaultValue appConfig.ui.icons.chevronRight
   * @IconifyIcon
   */
  separatorIcon?: IconProps['name']
  /** A string separator between items. Takes precedence over `separatorIcon`. */
  separator?: string
  /**
   * The key used to get the label from the item.
   * @defaultValue 'label'
   */
  labelKey?: GetItemKeys<T>
  /**
   * The maximum number of items to display. When exceeded, middle items are collapsed into an ellipsis.
   * Must be at least 2 (first + last). Does not count the ellipsis item itself.
   * @defaultValue undefined (show all)
   */
  maxItems?: number
  /**
   * The icon to use as the ellipsis when items are collapsed.
   * @defaultValue appConfig.ui.icons.ellipsis
   * @IconifyIcon
   */
  ellipsisIcon?: IconProps['name']
  class?: any
  ui?: Breadcrumb['slots']
}

type SlotProps<T extends BreadcrumbItem> = (props: { item: T, index: number, active: boolean, ui: Breadcrumb['ui'] }) => VNode[]

export type BreadcrumbSlots<T extends BreadcrumbItem = BreadcrumbItem> = {
  'item'?: SlotProps<T>
  'item-leading'?: SlotProps<T>
  'item-label'?: (props: { item: T, index: number, active: boolean }) => VNode[]
  'item-trailing'?: (props: { item: T, index: number, active: boolean }) => VNode[]
  'separator'?: (props: { ui: Breadcrumb['ui'] }) => VNode[]
  'overflow'?: (props: { ui: Breadcrumb['ui'] }) => VNode[]
}
& DynamicSlots<T, 'leading', { index: number, active: boolean, ui: Breadcrumb['ui'] }>
& DynamicSlots<T, 'label' | 'trailing', { index: number, active: boolean }>

</script>

<script setup lang="ts" generic="T extends BreadcrumbItem">
import { computed } from 'vue'
import { Primitive } from 'reka-ui'
import { useAppConfig } from '#imports'
import { useComponentUI } from '../composables/useComponentUI'
import { useLocale } from '../composables/useLocale'
import { get } from '../utils'
import { tv } from '../utils/tv'
import { pickLinkProps } from '../utils/link'
import UIcon from './Icon.vue'
import UAvatar from './Avatar.vue'
import ULinkBase from './LinkBase.vue'
import ULink from './Link.vue'

const props = withDefaults(defineProps<BreadcrumbProps<T>>(), {
  as: 'nav',
  labelKey: 'label'
})
const slots = defineSlots<BreadcrumbSlots<T>>()

const { dir } = useLocale()
const appConfig = useAppConfig() as Breadcrumb['AppConfig']
const uiProp = useComponentUI('breadcrumb', props)

const separatorIcon = computed(() => props.separatorIcon || (dir.value === 'rtl' ? appConfig.ui.icons.chevronLeft : appConfig.ui.icons.chevronRight))

const resolvedEllipsisIcon = computed(() => props.ellipsisIcon || appConfig.ui.icons.ellipsis)

type VisibleEntry = { type: 'item', item: T, originalIndex: number } | { type: 'overflow' }

const visibleItems = computed<VisibleEntry[]>(() => {
  if (!props.items?.length) {
    return []
  }
  // Always show all items when 2 or fewer — no room for meaningful collapse
  if (props.items.length <= 2 || !props.maxItems || props.items.length <= props.maxItems) {
    return props.items.map((item, i) => ({ type: 'item' as const, item, originalIndex: i }))
  }

  const max = Math.max(2, props.maxItems)
  // Always reserve first item (index 0), distribute remaining slots
  const headCount = Math.max(1, Math.ceil((max - 1) / 2))
  const tailCount = Math.max(1, max - headCount)

  const head: VisibleEntry[] = props.items.slice(0, headCount).map((item, i) => ({ type: 'item' as const, item, originalIndex: i }))
  const overflow: VisibleEntry = { type: 'overflow' }
  const tail: VisibleEntry[] = props.items.slice(props.items.length - tailCount).map((item, i) => ({ type: 'item' as const, item, originalIndex: props.items!.length - tailCount + i }))

  return [...head, overflow, ...tail]
})

// eslint-disable-next-line vue/no-dupe-keys
const ui = computed(() => tv({ extend: tv(theme), ...(appConfig.ui?.breadcrumb || {}) })())
</script>

<template>
  <Primitive v-if="items?.length" :as="as" aria-label="breadcrumb" data-slot="root" :class="ui.root({ class: [uiProp?.root, props.class] })">
    <ol data-slot="list" :class="ui.list({ class: uiProp?.list })">
      <template v-for="(entry, index) in visibleItems" :key="index">
        <!-- Overflow / ellipsis item -->
        <li v-if="entry.type === 'overflow'" data-slot="item" :class="ui.item({ class: uiProp?.item })">
          <slot name="overflow" :ui="ui">
            <UIcon :name="resolvedEllipsisIcon" data-slot="ellipsisIcon" aria-label="显示更多路径" :class="ui.ellipsisIcon({ class: uiProp?.ellipsisIcon })" />
          </slot>
        </li>

        <!-- Normal item -->
        <template v-else>
          <li data-slot="item" :class="ui.item({ class: [uiProp?.item, entry.item.ui?.item] })">
            <ULink v-slot="{ active, ...slotProps }" v-bind="pickLinkProps((entry.item.active ?? (entry.originalIndex === items!.length - 1)) ? { ...entry.item, to: undefined } : entry.item)" custom>
              <ULinkBase v-bind="slotProps" as="span" :aria-current="(entry.item.active ?? active) && (entry.originalIndex === items!.length - 1) ? 'page' : undefined" data-slot="link" :class="ui.link({ class: [uiProp?.link, entry.item.ui?.link, entry.item.class], active: entry.item.active ?? (entry.originalIndex === items!.length - 1), disabled: !!(entry.item.disabled || (entry.item.active ?? (entry.originalIndex === items!.length - 1))), to: (entry.item.active ?? (entry.originalIndex === items!.length - 1)) ? false : !!entry.item.to })">
                <slot :name="((entry.item.slot || 'item') as keyof BreadcrumbSlots<T>)" :item="(entry.item as Extract<T, { slot: string; }>)" :active="entry.item.active ?? (entry.originalIndex === items!.length - 1)" :index="entry.originalIndex" :ui="ui">
                  <slot :name="((entry.item.slot ? `${entry.item.slot}-leading`: 'item-leading') as keyof BreadcrumbSlots<T>)" :item="(entry.item as Extract<T, { slot: string; }>)" :active="entry.item.active ?? (entry.originalIndex === items!.length - 1)" :index="entry.originalIndex" :ui="ui">
                    <UIcon v-if="entry.item.icon" :name="entry.item.icon" data-slot="linkLeadingIcon" :class="ui.linkLeadingIcon({ class: [uiProp?.linkLeadingIcon, entry.item.ui?.linkLeadingIcon], active: entry.item.active ?? (entry.originalIndex === items!.length - 1) })" />
                    <UAvatar v-else-if="entry.item.avatar" :size="((uiProp?.linkLeadingAvatarSize || ui.linkLeadingAvatarSize()) as AvatarProps['size'])" v-bind="entry.item.avatar" data-slot="linkLeadingAvatar" :class="ui.linkLeadingAvatar({ class: [uiProp?.linkLeadingAvatar, entry.item.ui?.linkLeadingAvatar], active: entry.item.active ?? (entry.originalIndex === items!.length - 1) })" />
                  </slot>

                  <span v-if="get(entry.item, props.labelKey as string) || !!slots[(entry.item.slot ? `${entry.item.slot}-label`: 'item-label') as keyof BreadcrumbSlots<T>]" data-slot="linkLabel" :class="ui.linkLabel({ class: [uiProp?.linkLabel, entry.item.ui?.linkLabel] })">
                    <slot :name="((entry.item.slot ? `${entry.item.slot}-label`: 'item-label') as keyof DynamicSlots<T, 'label'>)" :item="(entry.item as Extract<T, { slot: string; }>)" :active="entry.item.active ?? (entry.originalIndex === items!.length - 1)" :index="entry.originalIndex">
                      {{ get(entry.item, props.labelKey as string) }}
                    </slot>
                  </span>

                  <slot :name="((entry.item.slot ? `${entry.item.slot}-trailing`: 'item-trailing') as keyof DynamicSlots<T, 'trailing'>)" :item="(entry.item as Extract<T, { slot: string; }>)" :active="entry.item.active ?? (entry.originalIndex === items!.length - 1)" :index="entry.originalIndex" />
                </slot>
              </ULinkBase>
            </ULink>
          </li>
        </template>

        <li v-if="index < visibleItems.length - 1" role="presentation" aria-hidden="true" data-slot="separator" :class="ui.separator({ class: [uiProp?.separator, entry.type === 'item' ? entry.item.ui?.separator : undefined] })">
          <slot name="separator" :ui="ui">
            <span v-if="props.separator" data-slot="separatorLabel" :class="ui.separatorLabel({ class: uiProp?.separatorLabel })">{{ props.separator }}</span>
            <UIcon v-else :name="separatorIcon" data-slot="separatorIcon" :class="ui.separatorIcon({ class: [uiProp?.separatorIcon, entry.type === 'item' ? entry.item.ui?.separatorIcon : undefined] })" />
          </slot>
        </li>
      </template>
    </ol>
  </Primitive>
</template>
