window.app.component('key-pair', {
  name: 'key-pair',
  template: '#key-pair',
  delimiters: ['${', '}'],
  props: {
    privateKey: {
      type: String,
      required: true
    },
    publicKey: {
      type: String,
      required: true
    }
  },
  data: function () {
    return {
      showPrivateKey: false
    }
  },
  methods: {
    copyText: function (text, message, position) {
      var notify = this.$q.notify
      Quasar.copyToClipboard(text).then(function () {
        notify({
          message: message || 'Copied to clipboard!',
          position: position || 'bottom'
        })
      })
    }
  }
})
