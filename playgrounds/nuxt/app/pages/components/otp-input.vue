<script setup lang="ts">
import theme from '#build/ui/otp-input'

const colors = Object.keys(theme.variants.color)
const sizes = Object.keys(theme.variants.size)
const variants = Object.keys(theme.variants.variant)

const attrs = reactive({
  color: [theme.defaultVariants.color],
  size: [theme.defaultVariants.size],
  variant: [theme.defaultVariants.variant]
})

const onComplete = (e: number[]) => {
  console.log('OTP complete:', e)
}
</script>

<template>
  <Navbar>
    <USelect v-model="attrs.color" :items="colors" multiple />
    <USelect v-model="attrs.size" :items="sizes" multiple />
    <USelect v-model="attrs.variant" :items="variants" multiple />
  </Navbar>

  <Matrix v-slot="props" :attrs="attrs">
    <UOTPInput placeholder="○" autofocus v-bind="props" @complete="onComplete" />
    <UOTPInput placeholder="○" highlight v-bind="props" />
    <UOTPInput placeholder="○" disabled v-bind="props" />
    <UOTPInput placeholder="○" required v-bind="props" />
  </Matrix>
</template>
