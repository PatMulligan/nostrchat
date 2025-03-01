window.app.component('nostracct-details', {
  name: 'nostracct-details',
  template: '#nostracct-details',
  delimiters: ['${', '}'],
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
    publicKey: {
      type: String,
      required: true
    },
    privateKey: {
      type: String,
      required: true
    },
    profileData: {
      type: Object,
      default: () => ({})
    }
  },
  data: function () {
    return {
      showPrivateKeyText: false,
      activeQrCode: null,
      loading: false,
      savingProfile: false,
      profile: {
        displayName: '',
        username: '',
        about: ''
      }
    }
  },
  computed: {
    npub() {
      try {
        if (this.publicKey) {
          return window.NostrTools.nip19.npubEncode(this.publicKey)
        }
      } catch (error) {
        console.error('Error encoding npub:', error)
      }
      return ''
    },
    nsec() {
      try {
        if (this.privateKey) {
          return window.NostrTools.nip19.nsecEncode(this.privateKey)
        }
      } catch (error) {
        console.error('Error encoding nsec:', error)
      }
      return ''
    },
    isMobile() {
      return this.$q.screen.lt.md
    }
  },
  methods: {
    copyText: function (text, message, position) {
      var notify = this.$q.notify
      Quasar.copyToClipboard(text).then(function () {
        notify({
          type: 'positive',
          message: message || 'Copied to clipboard!',
          position: position || 'bottom'
        })
      })
    },
    editProfile() {
      // Find the profile expansion item and open it
      const profileExpansion = document.querySelectorAll('.q-expansion-item')[1]
      if (profileExpansion && profileExpansion.__vue__) {
        profileExpansion.__vue__.show()
      }
    },
    async loadProfile() {
      try {
        this.loading = true
        const { data } = await LNbits.api.request(
          'GET',
          `/nostrchat/api/v1/nostracct/${this.nostracctId}/profile`,
          this.inkey
        )

        // Update profile data
        this.profile.displayName = data.display_name || ''
        this.profile.username = data.username || ''
        this.profile.about = data.about || ''
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      } finally {
        this.loading = false
      }
    },
    async saveProfile() {
      try {
        this.savingProfile = true

        const profileData = {
          display_name: this.profile.displayName,
          username: this.profile.username,
          about: this.profile.about
        }

        const { data } = await LNbits.api.request(
          'PUT',
          `/nostrchat/api/v1/nostracct/${this.nostracctId}/profile`,
          this.adminkey,
          profileData
        )

        this.$emit('nostracct-updated', data)
        this.$q.notify({
          type: 'positive',
          message: 'Profile updated and published to Nostr',
          timeout: 5000
        })
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      } finally {
        this.savingProfile = false
      }
    },
    async requeryNostrAcctData() {
      try {
        this.loading = true
        const { data } = await LNbits.api.request(
          'PUT',
          `/nostrchat/api/v1/nostracct/${this.nostracctId}/requery`,
          this.adminkey
        )
        this.$emit('nostracct-updated', data)

        // Update profile data after requery
        await this.loadProfile()

        this.$q.notify({
          type: 'positive',
          message: 'Nostr account data refreshed from Nostr',
          timeout: 5000
        })
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      } finally {
        this.loading = false
      }
    },
    async republishNostrAcctData() {
      try {
        this.loading = true
        const { data } = await LNbits.api.request(
          'PUT',
          `/nostrchat/api/v1/nostracct/${this.nostracctId}/republish`,
          this.adminkey
        )
        this.$emit('nostracct-updated', data)
        this.$q.notify({
          type: 'positive',
          message: 'Nostr account data republished to Nostr',
          timeout: 5000
        })
      } catch (error) {
        LNbits.utils.notifyApiError(error)
      } finally {
        this.loading = false
      }
    },
    async deleteNostrAcct() {
      LNbits.utils
        .confirmDialog('Are you sure you want to delete this Nostr account?')
        .onOk(async () => {
          try {
            this.loading = true
            await LNbits.api.request(
              'DELETE',
              `/nostrchat/api/v1/nostracct/${this.nostracctId}`,
              this.adminkey
            )
            this.$emit('nostracct-deleted')
            this.$q.notify({
              type: 'positive',
              message: 'Nostr account deleted',
              timeout: 5000
            })
          } catch (error) {
            LNbits.utils.notifyApiError(error)
          } finally {
            this.loading = false
          }
        })
    },
    async deleteNostrAcctFromNostr() {
      LNbits.utils
        .confirmDialog(
          'Are you sure you want to delete this Nostr account from Nostr?'
        )
        .onOk(async () => {
          try {
            this.loading = true
            await LNbits.api.request(
              'DELETE',
              `/nostrchat/api/v1/nostracct/${this.nostracctId}/nostr`,
              this.adminkey
            )
            this.$q.notify({
              type: 'positive',
              message: 'Nostr account deleted from Nostr',
              timeout: 5000
            })
          } catch (error) {
            LNbits.utils.notifyApiError(error)
          } finally {
            this.loading = false
          }
        })
    },
    toggleQrCode(codeType) {
      if (this.activeQrCode === codeType) {
        this.activeQrCode = null;
      } else {
        this.activeQrCode = codeType;
      }
    }
  },
  created() {
    // Load profile data when component is created
    this.loadProfile()
  }
})
