import { describe, it, expect } from 'vitest'
import { axe } from 'vitest-axe'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { renderEach } from '../component-render'
import Breadcrumb from '../../src/runtime/components/Breadcrumb.vue'

describe('Breadcrumb', () => {
  const items = [{
    label: 'Home',
    avatar: {
      src: 'https://github.com/benjamincanac.png',
      alt: 'Benjamin Canac'
    },
    to: '/'
  }, {
    label: 'Components',
    icon: 'i-lucide-box',
    disabled: true
  }, {
    label: 'Breadcrumb',
    to: '/components/breadcrumb',
    icon: 'i-lucide-link',
    slot: 'custom' as const
  }]

  const props = { items }

  renderEach(Breadcrumb<typeof items[number]>, [
    // Props
    ['with items', { props }],
    ['with labelKey', { props: { ...props, labelKey: 'icon' } }],
    ['with separatorIcon', { props: { ...props, separatorIcon: 'i-lucide-minus' } }],
    ['with separator string', { props: { ...props, separator: '>' } }],
    ['with as', { props: { ...props, as: 'div' } }],
    ['with class', { props: { ...props, class: 'w-48' } }],
    ['with ui', { props: { ...props, ui: { link: 'font-bold' } } }],
    ['with maxItems', { props: { items: longItems, maxItems: 3 } }],
    // Slots
    ['with item slot', { props, slots: { item: () => 'Item slot' } }],
    ['with item-leading slot', { props, slots: { 'item-leading': () => 'Item leading slot' } }],
    ['with item-label slot', { props, slots: { 'item-label': () => 'Item label slot' } }],
    ['with item-trailing slot', { props, slots: { 'item-trailing': () => 'Item trailing slot' } }],
    ['with custom slot', { props, slots: { custom: () => 'Custom slot' } }],
    ['with separator slot', { props, slots: { separator: () => '/' } }]
  ])

  it('passes accessibility tests', async () => {
    const wrapper = await mountSuspended(Breadcrumb, {
      props
    })

    expect(await axe(wrapper.element)).toHaveNoViolations()
  })

  it('renders ellipsis icon when items exceed maxItems', async () => {
    const wrapper = await mountSuspended(Breadcrumb, {
      props: {
        items: longItems,
        maxItems: 3
      }
    })

    // Should render: Home, ..., iPhone 15 (3 visible entries)
    const listItems = wrapper.findAll('li')
    // 3 items (Home, ellipsis, iPhone 15) + 2 separators = 5 li elements
    expect(listItems.length).toBe(5)

    // Check ellipsis icon exists
    const ellipsisIcon = wrapper.find('[data-slot="ellipsisIcon"]')
    expect(ellipsisIcon.exists()).toBe(true)

    // Check first and last items are present
    expect(wrapper.text()).toContain('Home')
    expect(wrapper.text()).toContain('iPhone 15')

    // Middle items should not be rendered
    expect(wrapper.text()).not.toContain('Products')
    expect(wrapper.text()).not.toContain('Electronics')
    expect(wrapper.text()).not.toContain('Phones')
  })

  it('renders all items when maxItems is not set', async () => {
    const wrapper = await mountSuspended(Breadcrumb, {
      props: {
        items: longItems
      }
    })

    // All 5 items should be visible
    expect(wrapper.text()).toContain('Home')
    expect(wrapper.text()).toContain('Products')
    expect(wrapper.text()).toContain('Electronics')
    expect(wrapper.text()).toContain('Phones')
    expect(wrapper.text()).toContain('iPhone 15')

    // No ellipsis
    expect(wrapper.find('[data-slot="ellipsisIcon"]').exists()).toBe(false)
  })

  it('renders nothing when items is empty', async () => {
    const wrapper = await mountSuspended(Breadcrumb, {
      props: {
        items: []
      }
    })

    expect(wrapper.html()).toBe('')
  })

  it('renders nothing when items is undefined', async () => {
    const wrapper = await mountSuspended(Breadcrumb, {
      props: {}
    })

    expect(wrapper.html()).toBe('')
  })
})

const longItems = [{
  label: 'Home',
  to: '/'
}, {
  label: 'Products',
  to: '/products'
}, {
  label: 'Electronics',
  to: '/products/electronics'
}, {
  label: 'Phones',
  to: '/products/electronics/phones'
}, {
  label: 'iPhone 15',
  to: '/products/electronics/phones/iphone-15'
}]
