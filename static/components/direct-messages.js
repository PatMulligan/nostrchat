window.app.component('direct-messages', {
  name: 'DirectMessages',
  template: '#direct-messages',

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
    }
  },

  data() {
    return {
      messages: [],
      newMessage: ''
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
    }
  },

  methods: {
    async getDirectMessages(pubkey) {
      if (!pubkey) {
        this.messages = []
        return
      }
      try {
        const { data } = await LNbits.api.request(
          'GET',
          '/nostrchat/api/v1/message/' + pubkey,
          this.inkey
        )
        this.messages = data
        this.focusOnChatBox(this.messages.length - 1)
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      }
    },

    async sendDirectMessage() {
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
        this.focusOnChatBox(this.messages.length - 1)
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      }
    },

    handleNewMessage(data) {
      if (data.peerPubkey === this.activePublicKey) {
        this.messages.push(data.dm)
        this.focusOnChatBox(this.messages.length - 1)
      }
      this.$emit('refresh-peers')
    },

    focusOnChatBox(index) {
      setTimeout(() => {
        const lastChatBox = document.getElementsByClassName(
          `chat-mesage-index-${index}`
        )
        if (lastChatBox && lastChatBox[0]) {
          lastChatBox[0].scrollIntoView()
        }
      }, 100)
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
