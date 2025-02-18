window.app.component('nostracct-details', {
  name: 'nostracct-details',
  template: '#nostracct-details',
  props: ['nostracct-id', 'adminkey', 'inkey', 'showKeys'],
  delimiters: ['${', '}'],
  data: function () {
    return {}
  },
  methods: {
    toggleShowKeys: async function () {
      this.$emit('toggle-show-keys')
    },

    republishNostrAcctData: async function () {
      try {
        await LNbits.api.request(
          'PUT',
          `/nostrchat/api/v1/nostracct/${this.nostracctId}/nostr`,
          this.adminkey
        )
        this.$q.notify({
          type: 'positive',
          message: 'NostrAcct data republished to Nostr',
          timeout: 5000
        })
      } catch (error) {
        console.warn(error)
        LNbits.utils.notifyApiError(error)
      }
    },
    requeryNostrAcctData: async function () {
      try {
        await LNbits.api.request(
          'GET',
          `/nostrchat/api/v1/nostracct/${this.nostracctId}/nostr`,
          this.adminkey
        )
        this.$q.notify({
          type: 'positive',
          message: 'NostrAcct data refreshed from Nostr',
          timeout: 5000
        })
      } catch (error) {
        console.warn(error)
        LNbits.utils.notifyApiError(error)
      }
    },
    deleteNostrAcctTables: function () {
      LNbits.utils
        .confirmDialog(
          `
             Stalls, products and orders will be deleted also!
             Are you sure you want to delete this nostracct?
            `
        )
        .onOk(async () => {
          try {
            await LNbits.api.request(
              'DELETE',
              '/nostrchat/api/v1/nostracct/' + this.nostracctId,
              this.adminkey
            )
            this.$emit('nostracct-deleted', this.nostracctId)
            this.$q.notify({
              type: 'positive',
              message: 'NostrAcct Deleted',
              timeout: 5000
            })
          } catch (error) {
            console.warn(error)
            LNbits.utils.notifyApiError(error)
          }
        })
    },
    deleteNostrAcctFromNostr: function () {
      LNbits.utils
        .confirmDialog(
          `
             Do you want to remove the nostracct from Nostr?
            `
        )
        .onOk(async () => {
          try {
            await LNbits.api.request(
              'DELETE',
              `/nostrchat/api/v1/nostracct/${this.nostracctId}/nostr`,
              this.adminkey
            )
            this.$q.notify({
              type: 'positive',
              message: 'NostrAcct Deleted from Nostr',
              timeout: 5000
            })
          } catch (error) {
            console.warn(error)
            LNbits.utils.notifyApiError(error)
          }
        })
    }
  },
  created: async function () {}
})
