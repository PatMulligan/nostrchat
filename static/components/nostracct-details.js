window.app.component('nostracct-details', {
  name: 'nostracct-details',
  template: '#nostracct-details',
  props: {
    nostracctId: {
      type: String,
      required: true
    },
    inkey: {
      type: String,
      required: true
    },
    adminkey: {
      type: String,
      required: true
    },
    showKeys: {
      type: Boolean,
      default: false
    }
  },
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
          message: 'Nostr Account data republished to Nostr',
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
          message: 'Nostr Account data refreshed from Nostr',
          timeout: 5000
        })
      } catch (error) {
        console.warn(error)
        LNbits.utils.notifyApiError(error)
      }
    },

    async deleteNostrAcct() {
      try {
        await LNbits.utils
          .confirmDialog(
            'Are you sure you want to delete this Nostr Account?'
          )
          .onOk(async () => {
            await LNbits.api.request(
              'DELETE',
              `/nostrchat/api/v1/nostracct/${this.nostracctId}`,
              this.adminkey
            )
            this.$emit('nostracct-deleted')
          })
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      }
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
              message: 'Nostr Account Deleted from Nostr',
              timeout: 5000
            })
          } catch (error) {
            console.warn(error)
            LNbits.utils.notifyApiError(error)
          }
        })
    }
  },
  created: async function () { }
})
