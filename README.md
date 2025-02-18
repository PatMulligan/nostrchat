# Nostr Chat - <small>[LNbits](https://github.com/lnbits/lnbits) extension</small>

<small>For more about LNBits extension check [this tutorial](https://github.com/lnbits/lnbits/wiki/LNbits-Extensions).</small>

## Prerequisites

This extension uses the LNbits [nostrclient](https://github.com/lnbits/nostrclient) extension, an extension that makes _nostrfying_ other extensions easy.
![image](https://user-images.githubusercontent.com/2951406/236773044-81d3f30b-1ce7-4c5d-bdaf-b4a80ddddc58.png)

- before you continue, please make sure that [nostrclient](https://github.com/lnbits/nostrclient) extension is installed, activated and correctly configured.
- [nostrclient](https://github.com/lnbits/nostrclient) is usually installed as admin-only extension, so if you do not have admin access please ask an admin to confirm that [nostrclient](https://github.com/lnbits/nostrclient) is OK.
- see the [Troubleshoot](https://github.com/lnbits/nostrclient#troubleshoot) section for more details on how to check the health of `nostrclient` extension

## Create, or import, a nostr account

For a nostr account you need to provide a Nostr key pair, or the extension can generate one for you.

> [!TODO] replace image link
> ![create keys](https://i.imgur.com/KhQYKOe.png)

Once you have a nostr account, you can view the details on the nostr account dropdown

> [!TODO] replace image link
> ![nostracct dropdown](https://i.imgur.com/M5abrK9.png)

![chat box](https://i.imgur.com/fhPP9IB.png)

## Nostr Chat Clients

> [!TODO] verify/update

- [ ] make quasar client

> [!TODO] verify/update
> LNbits also provides a Nostr Chat client app. You can visit the client from the nostr account dashboard by clicking on the "Nostrchat client" link
> ![market client link](https://i.imgur.com/3tsots2.png)

or by visiting `https://<LNbits instance URL>/nostrchat/chat`

> [!TODO] update
> Make sure to add your `nostracct` public key to the list:
> ![image](https://user-images.githubusercontent.com/2951406/236787686-0e300c0a-eb5d-4490-aa70-568738ac78f4.png)

## Troubleshoot

### Check communication with Nostr

In order to test that the integration with Nostr is working fine, one can add an `npub` to the chat box and check that DMs are working as expected:

<https://user-images.githubusercontent.com/2951406/236777983-259f81d8-136f-48b3-bb73-80749819b5f9.mov>

### Restart connection to Nostr

If the communication with Nostr is not working then an admin user can `Restart` the Nostr connection.

<https://user-images.githubusercontent.com/2951406/236778651-7ada9f6d-07a1-491c-ac9c-55530326c32a.mp4>

### Check Nostrclient extension

- see the [Troubleshoot](https://github.com/lnbits/nostrclient#troubleshoot) section for more details on how to check the health of `nostrclient` extension

## Additional info

Peer support is handled over whatever communication method was specified. If communicationg via nostr, [NIP-04](https://github.com/nostr-protocol/nips/blob/master/04.md) is used.
