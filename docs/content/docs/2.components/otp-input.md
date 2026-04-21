---
title: OTPInput
description: A specialized input for one-time password entry with 6 digits.
category: form
links:
  - label: PinInput
    icon: i-custom-reka-ui
    to: https://reka-ui.com/docs/components/pin-input
  - label: GitHub
    icon: i-simple-icons-github
    to: https://github.com/nuxt/ui/blob/v4/src/runtime/components/OTPInput.vue
---

## Usage

Use the `v-model` directive to control the value of the OTPInput.

:::component-code
---
prettier: true
ignore:
  - modelValue
external:
  - modelValue
props:
  modelValue: []
---
:::

Use the `default-value` prop to set the initial value when you do not need to control its state.

:::component-code
---
prettier: true
ignore:
  - defaultValue
props:
  defaultValue: [1, 2, 3]
---
:::

### Length

Use the `length` prop to change the amount of inputs. Defaults to `6`.

:::component-code
---
props:
  length: 4
---
:::

### Mask

Use the `mask` prop to treat the input like a password.

:::component-code
---
prettier: true
ignore:
  - placeholder
  - defaultValue
props:
  mask: true
  defaultValue: [1, 2, 3, 4, 5, 6]
---
:::

### Placeholder

Use the `placeholder` prop to set a placeholder text.

:::component-code
---
props:
  placeholder: '○'
---
:::

### Autofocus

Use the `autofocus` prop to automatically focus the first input on mount. Use `autofocus-delay` to delay the focus.

:::component-code
---
props:
  autofocus: true
  placeholder: '○'
---
:::

### Color

Use the `color` prop to change the ring color when the OTPInput is focused.

:::component-code
---
ignore:
  - placeholder
props:
  color: neutral
  highlight: true
  placeholder: '○'
---
:::

:::note
The `highlight` prop is used here to show the focus state. It's used internally when a validation error occurs.
:::

### Variant

Use the `variant` prop to change the variant of the OTPInput.

:::component-code
---
ignore:
  - placeholder
props:
  color: neutral
  variant: subtle
  highlight: false
  placeholder: '○'
---
:::

### Size

Use the `size` prop to change the size of the OTPInput.

:::component-code
---
ignore:
  - placeholder
props:
  size: xl
  placeholder: '○'
---
:::

### Disabled

Use the `disabled` prop to disable the OTPInput.

:::component-code
---
ignore:
  - placeholder
props:
  disabled: true
  placeholder: '○'
---
:::

## API

### Props

::component-props

### Emits

::component-emits

### Expose

When accessing the component via a template ref, you can use the following:

| Name | Type |
| ---- | ---- |
| `inputsRef`{lang="ts-type"} | `Ref<ComponentPublicInstance[]>`{lang="ts-type"} |

## Theme

::component-theme

## Changelog

::component-changelog
