window.app.component('chatbox', {
  name: 'Chatbox',
  template: '#chatbox',

  props: {
    nostracctId: {
      type: String,
      required: true
    },
    adminkey: {
      type: String,
      required: true
    },
    inkey: {
      type: String,
      required: true
    },
    activePublicKey: {
      type: String,
      default: null
    },
    peers: {
      type: Array,
      default: () => []
    }
  },

  data() {
    return {
      messages: [],
      newMessage: '',
      loading: false,
      lastRefreshTime: 0
    }
  },

  computed: {
    messagesAsJson() {
      return this.messages.map(m => {
        const dateFrom = moment(m.event_created_at * 1000).fromNow()
        try {
          const message = JSON.parse(m.message)
          return {
            isJson: message.type >= 0,
            dateFrom,
            ...m,
            message
          }
        } catch (error) {
          return {
            isJson: false,
            dateFrom,
            ...m,
            message: m.message
          }
        }
      })
    },

    activePeerName() {
      const peer = (this.peers || []).find(p => p?.public_key === this.activePublicKey)
      return peer?.profile?.name || 'Unknown Peer'
    }
  },

  methods: {
    async getDirectMessages(pubkey) {
      if (!pubkey) {
        this.messages = []
        return
      }

      this.loading = true
      try {
        const { data } = await LNbits.api.request(
          'GET',
          '/nostrchat/api/v1/message/' + pubkey,
          this.inkey
        )
        this.messages = data
        this.$nextTick(() => {
          this.scrollToBottom()
        })
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      } finally {
        this.loading = false
      }
    },

    async sendDirectMessage() {
      if (!this.newMessage.trim()) return

      try {
        const { data } = await LNbits.api.request(
          'POST',
          '/nostrchat/api/v1/message',
          this.adminkey,
          {
            message: this.newMessage,
            public_key: this.activePublicKey
          }
        )
        this.messages.push(data)
        this.newMessage = ''
        this.$nextTick(() => {
          this.scrollToBottom()
          this.$refs.messageInput.focus()
        })
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      }
    },

    handleNewMessage(data) {
      if (data.peerPubkey === this.activePublicKey) {
        // Check if this message already exists in our messages array
        const messageExists = this.messages.some(msg => msg.event_id === data.dm.event_id)

        if (!messageExists) {
          this.messages.push(data.dm)
          this.$nextTick(() => {
            this.scrollToBottom()
          })
        }
      }

      // Throttle refresh-peers events to at most once per second
      const now = Date.now()
      if (now - this.lastRefreshTime > 1000) {
        this.lastRefreshTime = now
        this.$emit('refresh-peers')
      }
    },

    scrollToBottom() {
      const chatBox = this.$refs.chatBox
      if (chatBox) {
        chatBox.scrollTop = chatBox.scrollHeight
      }
    },

    // Add a new method to focus the message input
    focusMessageInput() {
      this.$nextTick(() => {
        if (this.$refs.messageInput) {
          this.$refs.messageInput.focus()
        }
      })
    }
  },

  watch: {
    activePublicKey: {
      immediate: true,
      async handler(newVal) {
        await this.getDirectMessages(newVal)
      }
    }
  }
})
