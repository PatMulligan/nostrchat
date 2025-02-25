// Create Vue component for the extension
window.app = Vue.createApp({
  el: '#vue',
  mixins: [windowMixin],
  
  // Declare models/variables
  data() {
    return {
      nostracct: null,
      activeChatPeer: '',
      showKeys: false,
      importKeyDialog: {
        show: false,
        data: {
          privateKey: ''
        }
      },
      wsConnection: null
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
      this.activeChatPeer = ''
      this.showKeys = false
    },

    async getNostrAcct() {
      try {
        const {data} = await LNbits.api.request(
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
        const {data} = await LNbits.api.request(
          'POST',
          '/nostrchat/api/v1/nostracct',
          this.g.user.wallets[0].adminkey,
          payload
        )
        this.nostracct = data
        LNbits.utils.notifySuccess('Nostr Account Created!')
        this.waitForNotifications()
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      }
    },

    async waitForNotifications() {
      if (!this.nostracct) return
      
      try {
        const scheme = location.protocol === 'http:' ? 'ws' : 'wss'
        const port = location.port ? `:${location.port}` : ''
        const wsUrl = `${scheme}://${document.domain}${port}/api/v1/ws/${this.nostracct.id}`
        
        this.wsConnection = new WebSocket(wsUrl)
        this.wsConnection.addEventListener('message', async ({data}) => {
          const parsedData = JSON.parse(data)
          if (parsedData.type === 'dm:-1') {
            await this.$refs.directMessagesRef.handleNewMessage(parsedData)
          }
        })
      } catch (error) {
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
    }
  },

  // To run on startup
  created() {
    this.getNostrAcct()
    setInterval(() => {
      if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
        this.waitForNotifications()
      }
    }, 1000)
  }
})

// Mount after components are registered
setTimeout(() => {
  window.app.mount()
}, 0)
