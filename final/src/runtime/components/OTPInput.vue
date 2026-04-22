<script lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { PinInputRootEmits, PinInputRootProps } from 'reka-ui'
import type { AppConfig } from '@nuxt/schema'
import theme from '#build/ui/otp-input'
import type { ComponentConfig } from '../types/tv'

type OTPInput = ComponentConfig<typeof theme, AppConfig, 'otpInput'>

export interface OTPInputProps extends Pick<PinInputRootProps<'number'>, 'defaultValue' | 'disabled' | 'id' | 'mask' | 'modelValue' | 'name' | 'placeholder' | 'required'> {
  /**
   * The element or component this component should render as.
   * @defaultValue 'div'
   */
  as?: any
  /**
   * @defaultValue 'primary'
   */
  color?: OTPInput['variants']['color']
  /**
   * @defaultValue 'outline'
   */
  variant?: OTPInput['variants']['variant']
  /**
   * @defaultValue 'md'
   */
  size?: OTPInput['variants']['size']
  /**
   * The number of input fields.
   * @defaultValue 6
   */
  length?: number | string
  autofocus?: boolean
  autofocusDelay?: number
  highlight?: boolean
  /** Keep the mobile text size on all breakpoints. */
  fixed?: boolean
  class?: any
  ui?: OTPInput['slots']
}

export type OTPInputEmits = PinInputRootEmits<'number'> & {
  /** Fired when all inputs are filled. */
  complete: [value: string]
  change: [event: Event]
  blur: [event: FocusEvent]
}
</script>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { PinInputInput, PinInputRoot, useForwardPropsEmits } from 'reka-ui'
import { reactivePick } from '@vueuse/core'
import { useAppConfig } from '#imports'
import { useComponentUI } from '../composables/useComponentUI'
import { useFormField } from '../composables/useFormField'
import { looseToNumber } from '../utils'
import { tv } from '../utils/tv'

const props = withDefaults(defineProps<OTPInputProps>(), {
  length: 6,
  autofocusDelay: 0
})
const emits = defineEmits<OTPInputEmits>()

const appConfig = useAppConfig() as OTPInput['AppConfig']
const uiProp = useComponentUI('otpInput', props)

const rootProps = useForwardPropsEmits(reactivePick(props, 'disabled', 'id', 'mask', 'name', 'required'), emits)

const { emitFormInput, emitFormFocus, emitFormChange, emitFormBlur, size, color, id, name, highlight, disabled, ariaAttrs } = useFormField<OTPInputProps>(props)

const ui = computed(() => tv({ extend: tv(theme), ...(appConfig.ui?.otpInput || {}) })({
  color: color.value,
  variant: props.variant,
  size: size.value,
  highlight: highlight.value,
  fixed: props.fixed
}))

const inputsRef = ref<ComponentPublicInstance[]>([])

function setInputRef(index: number, el: Element | ComponentPublicInstance | null) {
  // @ts-expect-error - ComponentPublicInstance type mismatch in Nuxt module augmentation
  inputsRef.value[index] = el
}

const OTP_DIGIT_REGEX = /^[0-9]$/

const completed = ref(false)
function onComplete(value: number[]) {
  completed.value = true
  emits('complete', value.join(''))
  // @ts-expect-error - 'target' does not exist in type 'EventInit'
  const event = new Event('change', { target: { value } })
  emits('change', event)
  emitFormChange()
}

function onBlur(event: FocusEvent) {
  if (!event.relatedTarget || completed.value) {
    emits('blur', event)
    emitFormBlur()
  }
}

function onKeydown(event: KeyboardEvent) {
  // Allow: Backspace, Delete, Tab, Escape, Enter, Arrow keys
  if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(event.key)
    || // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
    ((event.ctrlKey || event.metaKey) && ['a', 'c', 'v', 'x'].includes(event.key))) {
    return
  }
  // Block non-digit single characters
  if (event.key.length === 1 && !OTP_DIGIT_REGEX.test(event.key)) {
    event.preventDefault()
  }
}

function autoFocus() {
  if (props.autofocus) {
    inputsRef.value[0]?.$el?.focus()
  }
}

onMounted(() => {
  setTimeout(() => {
    autoFocus()
  }, props.autofocusDelay)
})

defineExpose({
  inputsRef
})
</script>

<template>
  <PinInputRoot
    v-bind="{ ...rootProps, ...ariaAttrs }"
    :id="id"
    :name="name"
    :placeholder="placeholder"
    type="number"
    :otp="true"
    :model-value="modelValue"
    :default-value="defaultValue"
    data-slot="root"
    :class="ui.root({ class: [uiProp?.root, props.class] })"
    @update:model-value="emitFormInput()"
    @complete="onComplete"
  >
    <PinInputInput
      v-for="(ids, index) in looseToNumber(props.length)"
      :key="ids"
      :ref="el => setInputRef(index as number, el)"
      :index="(index as number)"
      inputmode="numeric"
      pattern="[0-9]"
      data-slot="base"
      :class="ui.base({ class: uiProp?.base })"
      :disabled="disabled"
      @keydown="onKeydown"
      @blur="onBlur"
      @focus="emitFormFocus"
    />
  </PinInputRoot>
</template>