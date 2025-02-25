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
    }
  },

  data() {
    return {
      peers: [],
      unreadMessages: 0,
      activePublicKey: null,
      messages: [],
      newMessage: '',
      showAddPublicKey: false,
      newPublicKey: null,
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

    async getPeers() {
      try {
        const { data } = await LNbits.api.request(
          'GET',
          '/nostrchat/api/v1/peer',
          this.inkey
        )
        this.peers = data
        this.unreadMessages = data.filter(c => c.unread_messages).length
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

    async addPublicKey() {
      try {
        const { data } = await LNbits.api.request(
          'POST',
          '/nostrchat/api/v1/peer',
          this.adminkey,
          {
            public_key: this.newPublicKey,
            nostracct_id: this.nostracctId,
            unread_messages: 0
          }
        )
        this.newPublicKey = null
        this.activePublicKey = data.public_key
        await this.selectActivePeer()
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      } finally {
        this.showAddPublicKey = false
      }
    },

    handleNewMessage: async function (data) {
      if (data.peerPubkey === this.activePublicKey) {
        this.messages.push(data.dm)
        this.focusOnChatBox(this.messages.length - 1)
        // focus back on input box
      }
      this.getPeersDebounced()
    },

    selectActivePeer: async function () {
      await this.getDirectMessages(this.activePublicKey)
      await this.getPeers()
    },

    focusOnChatBox: function (index) {
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
  },

  created() {
    this.getPeers()
    this.getPeersDebounced = _.debounce(this.getPeers, 2000, false)
  }
})
