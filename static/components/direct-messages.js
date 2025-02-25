import {API} from '../js/api.js'

window.app.component('direct-messages', {
  name: 'DirectMessages',
  
  props: {
    activeChatPeer: {
      type: String,
      default: ''
    },
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
      showRawMessage: false,
      rawMessage: null
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
        this.messages = await API.getDirectMessages(pubkey)
        this.focusOnChatBox(this.messages.length - 1)
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      }
    },

    async getPeers() {
      try {
        const peers = await API.getPeers()
        this.peers = peers
        this.unreadMessages = peers.filter(c => c.unread_messages).length
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      }
    },

    async sendDirectMessage() {
      try {
        const message = await API.sendDirectMessage({
          message: this.newMessage,
          public_key: this.activePublicKey
        })
        this.messages.push(message)
        this.newMessage = ''
        this.focusOnChatBox(this.messages.length - 1)
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      }
    },

    async addPublicKey() {
      try {
        const peer = await API.addPeer({
          public_key: this.newPublicKey,
          nostracct_id: this.nostracctId,
          unread_messages: 0
        })
        this.newPublicKey = null
        this.activePublicKey = peer.public_key
        await this.selectActivePeer()
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      } finally {
        this.showAddPublicKey = false
      }
    },

    buildPeerLabel: function (c) {
      let label = `${c.profile.name || 'unknown'} ${c.profile.about || ''}`
      if (c.unread_messages) {
        label += `[new: ${c.unread_messages}]`
      }
      label += `  (${c.public_key.slice(0, 16)}...${c.public_key.slice(
        c.public_key.length - 16
      )}`
      return label
    },

    handleNewMessage: async function (data) {
      if (data.peerPubkey === this.activePublicKey) {
        this.messages.push(data.dm)
        this.focusOnChatBox(this.messages.length - 1)
        // focus back on input box
      }
      this.getPeersDebounced()
    },

    showOrderDetails: function (orderId, eventId) {
      this.$emit('order-selected', {orderId, eventId})
    },

    showClientOrders: function () {
      this.$emit('peer-selected', this.activePublicKey)
    },

    selectActivePeer: async function () {
      await this.getDirectMessages(this.activePublicKey)
      await this.getPeers()
    },

    showMessageRawData: function (index) {
      this.rawMessage = this.messages[index]?.message
      this.showRawMessage = true
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
    activeChatPeer: {
      immediate: true,
      async handler(newVal) {
        this.activePublicKey = newVal
      }
    },
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
