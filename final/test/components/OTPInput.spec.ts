import { describe, it, expect, test } from 'vitest'
import { axe } from 'vitest-axe'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { renderEach } from '../component-render'
import { flushPromises, mount } from '@vue/test-utils'
import OTPInput from '../../src/runtime/components/OTPInput.vue'
import type { FormInputEvents } from '../../src/module'
import { renderForm } from '../utils/form'
import theme from '#build/ui/otp-input'

describe('OTPInput', () => {
  const sizes = Object.keys(theme.variants.size) as any
  const variants = Object.keys(theme.variants.variant) as any

  renderEach(OTPInput, [
    // Props
    ['with modelValue', { props: { modelValue: [1] } }],
    ['with defaultValue', { props: { defaultValue: [1, 2, 3] } }],
    ['with id', { props: { id: 'otp-input-id' } }],
    ['with name', { props: { name: 'otp-input-name' } }],
    ['with placeholder', { props: { placeholder: '○' } }],
    ['with length', { props: { length: 6 } }],
    ['with length 4', { props: { length: 4 } }],
    ['with disabled', { props: { disabled: true } }],
    ['with required', { props: { required: true } }],
    ['with mask', { props: { mask: true } }],
    ['with highlight', { props: { highlight: true } }],
    ['with autofocus', { props: { autofocus: true } }],
    ...sizes.map((size: string) => [`with size ${size}`, { props: { size } }]),
    ...variants.map((variant: string) => [`with primary variant ${variant}`, { props: { variant } }]),
    ...variants.map((variant: string) => [`with primary variant ${variant} highlight`, { props: { variant, highlight: true } }]),
    ...variants.map((variant: string) => [`with neutral variant ${variant}`, { props: { variant, color: 'neutral' } }]),
    ...variants.map((variant: string) => [`with neutral variant ${variant} highlight`, { props: { variant, color: 'neutral', highlight: true } }]),
    ['with ariaLabel', { attrs: { 'aria-label': 'Aria label' } }],
    ['with as', { props: { as: 'span' } }],
    ['with class', { props: { class: 'absolute' } }],
    ['with ui', { props: { ui: { base: 'rounded-full' } } }]
  ])

  it('renders correct number of inputs based on length prop', async () => {
    const wrapper = await mountSuspended(OTPInput, {
      props: { length: 6 }
    })
    const inputs = wrapper.findAll('input')
    expect(inputs).toHaveLength(6)
  })

  it('renders 4 inputs when length is 4', async () => {
    const wrapper = await mountSuspended(OTPInput, {
      props: { length: 4 }
    })
    const inputs = wrapper.findAll('input')
    expect(inputs).toHaveLength(4)
  })

  it('defaults to 6 inputs when length is not specified', async () => {
    const wrapper = await mountSuspended(OTPInput)
    const inputs = wrapper.findAll('input')
    expect(inputs).toHaveLength(6)
  })

  describe('emits', () => {
    test('complete event with joined string', async () => {
      const wrapper = mount(OTPInput)
      const input = wrapper.findComponent({ name: 'PinInputRoot' })
      await input.vm.$emit('complete', [1, 2, 3, 4, 5, 6])
      await flushPromises()
      expect(wrapper.emitted()).toMatchObject({ complete: [['123456']] })
    })

    test('change event on complete', async () => {
      const wrapper = mount(OTPInput)
      const input = wrapper.findComponent({ name: 'PinInputRoot' })
      await input.vm.$emit('complete', [1, 2, 3, 4, 5, 6])
      await flushPromises()
      expect(wrapper.emitted()).toMatchObject({ change: [[{ type: 'change' }]] })
    })

    test('blur event', async () => {
      const wrapper = mount(OTPInput)
      const lastPin = wrapper.find('input[aria-label="pin input 6 of 0"]')
      lastPin.trigger('blur')
      await flushPromises()

      expect(wrapper.emitted()).toMatchObject({ blur: [[{ type: 'blur' }]] })
    })
  })

  describe('form integration', async () => {
    async function createForm(validateOn?: FormInputEvents[]) {
      const wrapper = await renderForm({
        props: {
          validateOn,
          validateOnInputDelay: 0,
          async validate(state: any) {
            if (state.value?.length !== 6)
              return [{ name: 'value', message: 'Error message' }]
            return []
          }
        },
        slotTemplate: `
        <UFormField name="value">
          <UOTPInput id="input" v-model="state.value" />
        </UFormField>
        `
      })
      const input = wrapper.findComponent({ name: 'PinInputRoot' })
      return {
        wrapper,
        input
      }
    }

    test('validate on change works', async () => {
      const { input, wrapper } = await createForm(['change'])

      await input.vm.$emit('complete', [1, 2, 3, 4, 5])
      await flushPromises()
      expect(wrapper.text()).toContain('Error message')

      await input.vm.$emit('update:modelValue', [1, 2, 3, 4, 5, 6])
      await flushPromises()
      expect(wrapper.text()).not.toContain('Error message')
    })

    test('validate on blur works', async () => {
      const { input, wrapper } = await createForm(['blur'])
      const lastPin = wrapper.find('input[aria-label="pin input 6 of 6"]')

      await input.vm.$emit('update:modelValue', [1, 2, 3, 4, 5])
      lastPin.trigger('blur')
      await flushPromises()
      expect(wrapper.text()).toContain('Error message')

      await input.vm.$emit('update:modelValue', [1, 2, 3, 4, 5, 6])
      lastPin.trigger('blur')
      await flushPromises()
      expect(wrapper.text()).not.toContain('Error message')
    })

    test('validate on input works', async () => {
      const { input, wrapper } = await createForm(['input'])

      await input.vm.$emit('update:modelValue', [1, 2, 3, 4, 5])
      await flushPromises()
      expect(wrapper.text()).toContain('Error message')

      await input.vm.$emit('update:modelValue', [1, 2, 3, 4, 5, 6])
      await flushPromises()
      expect(wrapper.html()).not.toContain('Error message')
    })
  })

  it('passes accessibility tests', async () => {
    const wrapper = await mountSuspended(OTPInput, {
      props: {
        length: 6,
        placeholder: '○',
        required: true
      }
    })

    expect(await axe(wrapper.element)).toHaveNoViolations()
  })
})
