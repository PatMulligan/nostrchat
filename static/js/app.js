import {API} from './api.js'

const nostr = window.NostrTools

export const app = Vue.createApp({
  mixins: [window.windowMixin],
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
  methods: {
    generateKeys: async function () {
      const privateKey = nostr.generatePrivateKey()
      await this.createNostrAcct(privateKey)
    },
    importKeys: async function () {
      this.importKeyDialog.show = false
      let privateKey = this.importKeyDialog.data.privateKey
      if (!privateKey) {
        return
      }
      try {
        if (privateKey.toLowerCase().startsWith('nsec')) {
          privateKey = nostr.nip19.decode(privateKey).data
        }
      } catch (error) {
        this.$q.notify({
          type: 'negative',
          message: `${error}`
        })
      }
      await this.createNostrAcct(privateKey)
    },
    showImportKeysDialog: async function () {
      this.importKeyDialog.show = true
    },
    toggleShowKeys: function () {
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
        this.nostracct = await API.getNostrAcct()
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      }
    },
    async createNostrAcct(privateKey) {
      try {
        const pubkey = nostr.getPublicKey(privateKey)
        const payload = {
          private_key: privateKey,
          public_key: pubkey,
          config: {}
        }
        this.nostracct = await API.createNostrAcct(payload)
        this.$q.notify({
          type: 'positive',
          message: 'Nostr Account Created!'
        })
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
        this.wsConnection.onmessage = async e => {
          const data = JSON.parse(e.data)
          if (data.type === 'dm:-1') {
            await this.$refs.directMessagesRef.handleNewMessage(data)
          }
        }
      } catch (error) {
        this.$q.notify({
          timeout: 5000,
          type: 'warning',
          message: 'Failed to watch for updates',
          caption: `${error}`
        })
      }
    },
    async restartNostrConnection() {
      try {
        await LNbits.utils.confirmDialog(
          'Are you sure you want to reconnect to the nostrcient extension?'
        )
        await API.restartConnection()
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      }
    }
  },
  created() {
    this.getNostrAcct()
    setInterval(() => {
      if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
        this.waitForNotifications()
      }
    }, 1000)
  }
}) 