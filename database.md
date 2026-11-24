# Yope Content Creation App Database Schema

### Users

- _id
- name
- email
- password hash
- timezone
- status: active, suspended
- deleted at
- created at
- updated at

### Platforms

- _id
- user id
- code: TG, FB, YB, TK, IG, LN
- account name
- platform account id
- details: Mixed
- expires at
- status: connected, expired, revoked, error
- last error
- deleted at
- created at
- updated at

<!-- TG (telegram), FB (facebook), YB (youtube), YBS (youtube short), TK (tiktok), IG (instagram), LN (linkedin) -->

### Prompts

- _id
- parent prompt id
- user id
- content id
- type: content
- prompt
- response
- model
- tokens in
- tokens out
- status: pending, streaming, done, failed
- error
- deleted at
- created at
- updated at

### Contents

- _id
- user id
- title
- details: []
  - type: text, image, audio, video
  - script
  - path
  - text
  - order
- status: draft, generating, ready, approved, archived
- deleted at
- created at
- updated at

### Posts

- _id
- user id
- content id
- scheduled at
- status: draft, scheduled, publishing, published, partial, failed
- deleted at
- created at
- updated at

### Post Targets

- _id
- post id
- user id
- platform id
- platform code
- scheduled at
- status: pending, publishing, published, failed, skipped
- attempts
- next attempt at
- error
- external post id
- external url
- payload override
- published at
- deleted at
- created at
- updated at
