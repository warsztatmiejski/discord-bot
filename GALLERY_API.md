# Discord bot → Gallery API contract

Default base URL:

```text
https://warsztatmiejski.org
```

All requests use the same private service token:

```http
Authorization: Bearer <GALLERY_DISCORD_INGEST_SECRET>
```

The token must never be exposed to browser clients or logs.

## Image attachments

The bot downloads the Discord attachment and forwards it immediately:

```http
POST /api/gallery/import/discord
Content-Type: multipart/form-data
```

Required fields are `mediaKind=image`, `file`, `attachmentId`, `guildId`,
`channelId`, `messageId`, `authorId`, and `messageUrl`. Optional fields are
`author`, `username`, `channel`, `message`, and `createdAt`.

Successful response:

```json
{
  "success": true,
  "submissionId": "123",
  "status": "published",
  "suppressed": false
}
```

`suppressed: true` means an administrator previously removed the attachment.
The bot treats it as processed and does not try to restore it.

The website accepts JPEG, PNG, GIF and WebP. IDs contain 5–32 decimal digits,
`messageUrl` is a Discord message URL, and the declared MIME type must match the
decoded image. The website's default maximum is 20 MB, configured with
`GALLERY_MAX_IMAGE_BYTES`. `attachmentId` supplies idempotency.

## Video reservation

Before uploading a video to YouTube:

```http
POST /api/gallery/import/discord
Idempotency-Key: discord:<messageId>:<attachmentId>
Content-Type: application/json
```

```json
{
  "mediaKind": "youtube_video",
  "ingestionVersion": 1,
  "source": {
    "platform": "discord",
    "guildId": "123456789012345678",
    "channelId": "223456789012345678",
    "channelName": "projekty",
    "messageId": "323456789012345678",
    "messageUrl": "https://discord.com/channels/123456789012345678/223456789012345678/323456789012345678",
    "attachmentId": "423456789012345678",
    "createdAt": "2026-09-04T10:00:00Z"
  },
  "author": {
    "discordId": "523456789012345678",
    "username": "kowalski",
    "displayName": "Jan Kowalski"
  },
  "asset": {
    "filename": "prototype.mp4",
    "contentType": "video/mp4",
    "size": 12345678
  }
}
```

New reservation — HTTP 201:

```json
{
  "submissionId": "123",
  "status": "pending",
  "existing": false
}
```

Repeated published reservation — HTTP 200:

```json
{
  "submissionId": "123",
  "status": "published",
  "existing": true,
  "providerId": "dQw4w9WgXcQ",
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

An existing removed item also returns `archived: true`. Published existing or
archived items must not be uploaded again. The default video limit is 20 MB and
is controlled by `GALLERY_MAX_DISCORD_VIDEO_BYTES` on both services.

## Video lifecycle

Updates use:

```http
PATCH /api/gallery/import/discord/<submissionId>
Content-Type: application/json
```

Valid lifecycle:

```text
pending → uploading → uploaded → playlist_added → published
```

Forward states may be skipped, the current state may be repeated, and any state
may transition to `failed`.

Successful finalization:

```json
{
  "status": "published",
  "provider": "youtube",
  "providerId": "dQw4w9WgXcQ",
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "playlistId": "PLxxxxxxxx",
  "playlistItemId": "UExxxxxxxxx",
  "title": "Resolved video title"
}
```

The website validates the 11-character YouTube ID and generates canonical,
privacy-enhanced embed and thumbnail URLs itself. Playlist IDs are optional and
the submitted `url` is intentionally ignored. Reusing a YouTube ID assigned to
another gallery item returns HTTP 409. Only `published` video submissions are
public.

Failure update:

```json
{
  "status": "failed",
  "errorCode": "youtube_upload_failed"
}
```

Possible bot error codes are `youtube_upload_failed`,
`youtube_processing_failed`, `youtube_playlist_failed`, and
`gallery_finalize_failed`. They contain no provider response, token, or personal
information. Complete errors remain only in protected bot logs.

## Reaction semantics

Every attachment is processed independently. Images use the multipart endpoint;
videos use reservation, YouTube, playlist and finalization. Successful processing
is silent and leaves the `:gallery:` reaction in place. If any attachment fails,
the bot removes the trustee's reaction and reports a sanitized error; successful
attachments remain idempotently recorded, so retrying does not duplicate them.
An unfinished pending video is not a success.

The website never modifies Discord reactions or messages. The interactive
Discord-to-Google-Drive workflow remains separate.
