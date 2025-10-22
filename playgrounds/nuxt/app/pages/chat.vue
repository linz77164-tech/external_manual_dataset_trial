<script setup lang="ts">
import type { UIMessage } from 'ai'
import { Chat } from '@ai-sdk/vue'
import { getTextFromMessage } from '@nuxt/ui/utils/ai'

const toast = useToast()

const messages: UIMessage[] = [{
  id: '1',
  role: 'user',
  parts: [{ type: 'text', text: 'Hello, how are you?' }]
}, {
  id: '2',
  role: 'assistant',
  parts: [{ type: 'text', text: 'I\'m good, thank you! How can I help you today?' }]
}]
const input = ref('')

const chat = new Chat({
  messages,
  onError(error) {
    const { message: description } = typeof error.message === 'string' && error.message[0] === '{' ? JSON.parse(error.message) : error

    toast.add({
      description,
      icon: 'i-lucide-alert-circle',
      color: 'error',
      duration: 0
    })
  }
})

function onSubmit() {
  chat.sendMessage({ text: input.value })

  input.value = ''
}
</script>

<template>
  <UDashboardNavbar class="absolute top-0 inset-x-0 z-5 border-b-0 lg:pointer-events-none" />

  <div class="flex-1 flex flex-col gap-4 sm:gap-6 max-w-xl w-full mx-auto min-h-0">
    <UChatMessages
      :messages="chat.messages"
      :status="chat.status"
      :user="{ avatar: { src: 'https://github.com/benjamincanac.png' } }"
      :spacing-offset="48"
    >
      <template #content="{ message }">
        <MDC :value="getTextFromMessage(message)" :cache-key="message.id" class="*:first:mt-0 *:last:mb-0" />
      </template>
    </UChatMessages>

    <UChatPrompt v-model="input" :error="chat.error" variant="subtle" class="sticky bottom-0" @submit="onSubmit">
      <UChatPromptSubmit :status="chat.status" @stop="chat.stop" @reload="chat.regenerate" />
    </UChatPrompt>
  </div>
</template>
