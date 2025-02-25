export const API = {
  // Get nostr account
  async getNostrAcct() {
    const {data} = await LNbits.api.request(
      'GET',
      '/nostrchat/api/v1/nostracct'
    )
    return data
  },

  // Create nostr account
  async createNostrAcct(payload) {
    const {data} = await LNbits.api.request(
      'POST', 
      '/nostrchat/api/v1/nostracct',
      payload
    )
    return data
  },

  // Get direct messages
  async getDirectMessages(pubkey) {
    const {data} = await LNbits.api.request(
      'GET',
      '/nostrchat/api/v1/message/' + pubkey
    )
    return data
  },

  // Send direct message
  async sendDirectMessage(payload) {
    const {data} = await LNbits.api.request(
      'POST',
      '/nostrchat/api/v1/message',
      payload
    )
    return data
  },

  // Get peers
  async getPeers() {
    const {data} = await LNbits.api.request(
      'GET',
      '/nostrchat/api/v1/peer'
    )
    return data
  },

  // Add peer
  async addPeer(payload) {
    const {data} = await LNbits.api.request(
      'POST',
      '/nostrchat/api/v1/peer',
      payload 
    )
    return data
  },

  // Restart nostr connection
  async restartConnection() {
    await LNbits.api.request(
      'PUT',
      '/nostrchat/api/v1/restart'
    )
  }
} 