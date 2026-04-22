<script setup lang="ts">
const otpValue = ref('')
const onComplete = (value: string) => {
  otpValue.value = value
  console.log('OTP complete:', value)
}
</script>

<template>
  <UDashboardNavbar class="absolute top-0 inset-x-0 lg:border-b-0" />

  <div class="text-center space-y-4">
    <h1 class="text-2xl font-bold text-primary">
      Playground
    </h1>
    <p class="max-w-sm mx-auto text-muted">
      Explore and test all Nuxt UI components in an interactive environment.
    </p>

    <div class="mt-8 space-y-4">
      <p class="text-sm text-muted">OTPInput 验证 (length=4, highlight)</p>
      <p v-if="otpValue" class="text-sm text-primary font-mono">
        完成！OTP = {{ otpValue }}
      </p>
    </div>
  </div>
</template>
