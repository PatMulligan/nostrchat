// Create Vue component for the extension
window.app = Vue.createApp({
  el: '#vue',
  mixins: [windowMixin],

  // Declare models/variables
  data() {
    return {
      nostracct: null,
      showKeys: false,
      importKeyDialog: {
        show: false,
        data: {
          privateKey: ''
        }
      },
      wsConnection: null,
      peers: [],
      activePublicKey: null,
      showAddPeer: false,
      newPeerKey: null,
      isMobileView: false,
      windowHeight: window.innerHeight - 120,
      peerRefreshTimeout: null,
      peerRefreshInProgress: false
    }
  },

  computed: {
    showPeersList() {
      return !this.$q.screen.lt.md || !this.activePublicKey
    },

    showChatBox() {
      return !this.$q.screen.lt.md || this.activePublicKey
    },

    activePeerName() {
      const peer = this.peers.find(p => p?.public_key === this.activePublicKey)
      return peer?.profile?.name || 'Unknown Peer'
    }
  },

  // Where functions live
  methods: {
    generateKeys: async function () {
      const privateKey = window.NostrTools.generatePrivateKey()
      await this.createNostrAcct(privateKey)
    },

    importKeys: async function () {
      this.importKeyDialog.show = false
      let privateKey = this.importKeyDialog.data.privateKey
      if (!privateKey) return

      try {
        if (privateKey.toLowerCase().startsWith('nsec')) {
          privateKey = window.NostrTools.nip19.decode(privateKey).data
        }
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      }
      await this.createNostrAcct(privateKey)
    },

    showImportKeysDialog() {
      this.importKeyDialog.show = true
    },

    toggleShowKeys() {
      this.showKeys = !this.showKeys
    },

    toggleNostrAcctState: async function () {
      const nostracct = await this.getNostrAcct()
      if (!nostracct) {
        this.$q.notify({
          timeout: 5000,
          type: 'warning',
          message: 'Cannot fetch nostracct!'
        })
        return
      }
      const message = nostracct.config.active
        ? 'New orders will not be processed. Are you sure you want to deactivate?'
        : nostracct.config.restore_in_progress
          ? 'NostrAcct restore  from nostr in progress. Please wait!! ' +
          'Activating now can lead to duplicate order processing. Click "OK" if you want to activate anyway?'
          : 'Are you sure you want activate this nostracct?'

      LNbits.utils.confirmDialog(message).onOk(async () => {
        await this.toggleNostrAcct()
      })
    },

    toggleNostrAcct: async function () {
      try {
        const { data } = await LNbits.api.request(
          'PUT',
          `/nostrchat/api/v1/nostracct/${this.nostracct.id}/toggle`,
          this.g.user.wallets[0].adminkey
        )
        const state = data.config.active ? 'activated' : 'disabled'
        this.nostracct = data
        this.$q.notify({
          type: 'positive',
          message: `'NostrAcct ${state}`,
          timeout: 5000
        })
      } catch (error) {
        console.warn(error)
        LNbits.utils.notifyApiError(error)
      }
    },

    handleNostrAcctDeleted: function () {
      this.nostracct = null
      this.showKeys = false
    },

    async getNostrAcct() {
      try {
        const { data } = await LNbits.api.request(
          'GET',
          '/nostrchat/api/v1/nostracct',
          this.g.user.wallets[0].inkey
        )
        this.nostracct = data
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      }
    },

    async createNostrAcct(privateKey) {
      try {
        const pubkey = window.NostrTools.getPublicKey(privateKey)
        const payload = {
          private_key: privateKey,
          public_key: pubkey,
          config: {}
        }
        const { data } = await LNbits.api.request(
          'POST',
          '/nostrchat/api/v1/nostracct',
          this.g.user.wallets[0].adminkey,
          payload
        )
        this.nostracct = data
        this.$q.notify({
          type: 'positive',
          message: 'Nostr Account Created!',
          icon: 'check',
          timeout: 5000
        })
        this.waitForNotifications()
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      }
    },

    async waitForNotifications() {
      if (!this.nostracct) return

      try {
        // Close existing connection if it exists
        if (this.wsConnection) {
          if (this.wsConnection.readyState === WebSocket.OPEN ||
            this.wsConnection.readyState === WebSocket.CONNECTING) {
            // Connection exists and is either open or connecting, no need to create a new one
            return
          } else {
            // Connection exists but is closing or closed, clean it up
            this.wsConnection.close()
            this.wsConnection = null
          }
        }

        const scheme = location.protocol === 'http:' ? 'ws' : 'wss'
        const port = location.port ? `:${location.port}` : ''
        const wsUrl = `${scheme}://${document.domain}${port}/api/v1/ws/${this.nostracct.id}`

        console.log("Connecting to notifications at:", wsUrl)
        this.wsConnection = new WebSocket(wsUrl)

        this.wsConnection.addEventListener('open', () => {
          console.log("WebSocket connection established")
        })

        this.wsConnection.addEventListener('close', () => {
          console.log("WebSocket connection closed")
          // Don't immediately reconnect here - let the interval handle it
        })

        this.wsConnection.addEventListener('error', (error) => {
          console.error("WebSocket error:", error)
          this.wsConnection = null // Clear reference on error
        })

        this.wsConnection.addEventListener('message', async ({ data }) => {
          const parsedData = JSON.parse(data)
          if (parsedData.type === 'dm:-1') {
            await this.$refs.chatBoxRef.handleNewMessage(parsedData)
          }
        })
      } catch (error) {
        console.error("WebSocket connection error:", error)
        this.wsConnection = null
        LNbits.utils.notifyError('Failed to watch for updates')
      }
    },

    async restartNostrConnection() {
      try {
        await LNbits.utils.confirmDialog(
          'Are you sure you want to reconnect to the nostrcient extension?'
        )
        await LNbits.api.request(
          'PUT',
          '/nostrchat/api/v1/restart',
          this.g.user.wallets[0].adminkey
        )
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      }
    },

    async getPeers() {
      // Cancel any pending refresh
      if (this.peerRefreshTimeout) {
        clearTimeout(this.peerRefreshTimeout)
        this.peerRefreshTimeout = null
      }

      // If a refresh is already in progress, schedule another one for later
      if (this.peerRefreshInProgress) {
        this.peerRefreshTimeout = setTimeout(() => this.getPeers(), 500)
        return
      }

      this.peerRefreshInProgress = true
      try {
        const { data } = await LNbits.api.request(
          'GET',
          '/nostrchat/api/v1/peer',
          this.g.user.wallets[0].inkey
        )
        this.peers = data
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      } finally {
        this.peerRefreshInProgress = false
      }
    },

    async addPeer() {
      try {
        const { data } = await LNbits.api.request(
          'POST',
          '/nostrchat/api/v1/peer',
          this.g.user.wallets[0].adminkey,
          {
            public_key: this.newPeerKey,
            nostracct_id: this.nostracct.id,
            unread_messages: 0
          }
        )
        this.newPeerKey = null
        this.activePublicKey = data.public_key
        await this.getPeers()
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      } finally {
        this.showAddPeer = false
      }
    },

    handlePeerSelected(publicKey) {
      this.activePublicKey = publicKey
      // Add a slight delay to ensure the DOM has updated
      this.$nextTick(() => {
        if (this.$refs.chatBoxRef) {
          this.$refs.chatBoxRef.focusMessageInput()
        }
      })
    },

    handleBackToList() {
      this.activePublicKey = null
    },

    refreshPeers() {
      if (this.peerRefreshTimeout) {
        clearTimeout(this.peerRefreshTimeout)
      }
      this.peerRefreshTimeout = setTimeout(() => this.getPeers(), 300)
    },

    handleResize() {
      // Update window height when the viewport changes (e.g., keyboard appears)
      this.windowHeight = window.innerHeight - 120
    }
  },

  // To run on startup
  created() {
    this.getNostrAcct()
    window.addEventListener('resize', this.handleResize)

    // Check connection status every 5 seconds instead of every second
    this.wsCheckInterval = setInterval(() => {
      if (!this.nostracct) return

      if (!this.wsConnection ||
        this.wsConnection.readyState === WebSocket.CLOSED ||
        this.wsConnection.readyState === WebSocket.CLOSING) {
        console.log("WebSocket reconnecting...")
        this.waitForNotifications()
      }
    }, 5000) // Check every 5 seconds instead of every 1 second
  },

  beforeDestroy() {
    // Clean up interval and connection when component is destroyed
    if (this.wsCheckInterval) {
      clearInterval(this.wsCheckInterval)
    }

    if (this.wsConnection) {
      this.wsConnection.close()
      this.wsConnection = null
    }

    window.removeEventListener('resize', this.handleResize)
  },

  watch: {
    'nostracct.id': {
      immediate: true,
      handler(newVal) {
        if (newVal) {
          this.getPeers()
        }
      }
    }
  }
})

// Mount after components are registered
setTimeout(() => {
  window.app.mount()
}, 0)
