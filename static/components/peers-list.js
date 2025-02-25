window.app.component('peers-list', {
  name: 'PeersList',
  template: '#peers-list',

  props: {
    peers: {
      type: Array,
      default: () => []
    },
    activePublicKey: {
      type: String,
      default: null
    }
  },

  computed: {
    unreadMessages() {
      return (this.peers || []).filter(p => p?.unread_messages).length
    }
  }
}) 