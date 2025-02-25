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
      loading: false
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
      const peer = this.peers.find(p => p.public_key === this.activePublicKey)
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
        this.messages.push(data.dm)
        this.$nextTick(() => {
          this.scrollToBottom()
        })
      }
      this.$emit('refresh-peers')
    },

    scrollToBottom() {
      const chatBox = this.$refs.chatBox
      if (chatBox) {
        chatBox.scrollTop = chatBox.scrollHeight
      }
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
