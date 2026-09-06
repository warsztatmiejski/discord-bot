# Św. MacGyver – Bot Warsztatu Miejskiego na Discord

Bot Discord dla społeczności Warsztatu Miejskiego. Obsługuje automatyzacje
serwerowe, asystenta AI, powiadomienia o mailach z Gmaila oraz publikowanie
mediów z Discorda na Google Drive i w galerii internetowej.

## Najważniejsze funkcje

- Asystent AI uruchamiany przez wzmiankę bota, z pamięcią kilku ostatnich tur
  rozmowy w kanale, obsługą obrazów, narzędziami `web_search` i
  `code_interpreter` oraz lokalną bazą wiedzy Warsztatu.
- Limity kosztów AI: globalny dzienny budżet i dzienne limity per rola,
  zapisywane w `cost-tracker.json`.
- Skrót do wydarzeń: gdy wzmianka zawiera pytanie o wydarzenia, bot pokazuje
  najbliższe wydarzenia z Discord Scheduled Events i link do kanału kalendarza.
- Powitania nowych członków na kanale zdefiniowanym w `.env`.
- Reakcje na słowa kluczowe, sterowane komendą `/reakcje`, z cooldownem 72h na
  daną odpowiedź.
- Komendy administracyjne i informacyjne: `/reakcje`, `/ludzie`, `/koszty`,
  `/faktury`, `/kontekst`, `/move`.
- Menu kontekstowe wiadomości: `Move` i `Reply as Bot`.
- Przenoszenie wiadomości przez webhook z zachowaniem autora, avatara,
  załączników, embedów i linku do źródła.
- Obsługa mediów w wybranym kanale: użytkownik wybiera folder Google Drive albo
  tworzy nowy, a bot zapisuje obrazy/wideo z metadanymi autora.
- Upload do galerii przez reakcję: użytkownik z rolą `trustee` dodaje do
  wiadomości niestandardową reakcję `:gallery:`. Obrazy trafiają przez API
  strony do Cloudflare R2, a filmy na kanał YouTube i do wskazanej playlisty.
  Bot kolejkowuje obrazy i wysyła do strony tylko jeden naraz, aby ograniczyć
  zużycie pamięci podczas tworzenia wariantów. Ponowne użycie reakcji nie tworzy
  duplikatów tych samych załączników.
- Sprawdzanie konta obsługi faktur na Gmailu automatycznie po starcie
  oraz codziennie o 09:00, 13:00 i 17:00 czasu serwera, plus ręcznie przez
  `/faktury`.

## Stos techniczny

- Node.js, CommonJS.
- `discord.js` v14.
- OpenAI Responses API przez pakiet `openai`.
- Google APIs: Drive v3, Gmail v1 i YouTube Data API v3.
- `dotenv` do ładowania konfiguracji z `.env`.

Zalecana wersja Node.js: 18 lub nowsza.

## Struktura projektu

- `index.js` - punkt wejścia bota, rejestruje eventy Discorda.
- `deploy-commands.js` - publikuje slash commands i menu kontekstowe na serwerze.
- `commands.js` - obsługa komend Discorda.
- `ai.js` - asystent AI, pamięć rozmowy i liczenie kosztów.
- `warsztat-miejski.js` oraz `warsztat-miejski.json` - lokalna baza wiedzy
  wstrzykiwana do promptu zależnie od pytania.
- `media.js` i `googleDrive.js` - interaktywny workflow uploadu mediów do
  Google Drive oraz wspólne operacje na plikach i folderach Drive.
- `gallery.js` - obsługa reakcji `:gallery:` i koordynacja publikacji w galerii.
- `gallery-api.js` - uwierzytelniona komunikacja z API strony galerii.
- `gallery-state.js` - trwały stan uploadów YouTube chroniący przed duplikatami
  po restarcie lub przejściowej awarii API strony.
- `gallery-utils.js` - filtrowanie obsługiwanych załączników i budowanie ich
  metadanych Discorda; testy znajdują się w `gallery-utils.test.js`.
- `youtube.js` - OAuth, wznawialny upload filmów i dodawanie ich do playlisty.
- `GALLERY_API.md` - kontrakt endpointów, payloadów i stanów wymaganych po
  stronie serwisu internetowego.
- `gmail.js` i `email-checker.js` - autoryzacja Gmaila i powiadomienia o nowych
  nieprzeczytanych mailach.
- `keywords.js` - reakcje na słowa kluczowe.
- `move-message.js` - repost wiadomości przez webhook.
- `config.json` - niesekretna konfiguracja działania bota.
- `start_bot.sh` - skrypt startowy używany na serwerze produkcyjnym.

## Wymagane dane środowiskowe

Utwórz lokalny plik `.env` w katalogu projektu. Nie commituj tego pliku.

```env
BOT_TOKEN=discord_bot_token
CLIENT_ID=discord_application_client_id
GUILD_ID=discord_server_id
OPENAI_API_KEY=openai_api_key
WELCOME_CHANNEL_ID=discord_channel_id
MEDIA_CHANNEL_ID=discord_channel_id
FAKTURY_CHANNEL_ID=discord_channel_id
SHARED_DRIVE_ID=google_shared_drive_or_folder_id
GALLERY_API_BASE_URL=https://warsztatmiejski.org
GALLERY_DISCORD_INGEST_SECRET=strong_shared_service_token
GALLERY_MAX_IMAGE_BYTES=20000000
GALLERY_MAX_DISCORD_VIDEO_BYTES=20000000
# GALLERY_API_TIMEOUT_MS=120000
# GALLERY_IMAGE_DOWNLOAD_TIMEOUT_MS=120000
# GALLERY_IMAGE_UPLOAD_TIMEOUT_MS=120000
# GALLERY_API_RETRY_COUNT=2
# GALLERY_API_RETRY_DELAY_MS=500
YOUTUBE_CHANNEL_ID=expected_youtube_channel_id
YOUTUBE_PLAYLIST_ID=gallery_playlist_id

# Opcjonalne ustawienia uploadu YouTube.
# YOUTUBE_CREDENTIALS_PATH=/secure/path/credentials_youtube.json
# YOUTUBE_TOKEN_PATH=/secure/path/token_youtube.json
# YOUTUBE_REDIRECT_URI=http://localhost:3000/oauth2callback
YOUTUBE_PRIVACY_STATUS=unlisted
YOUTUBE_CATEGORY_ID=22
YOUTUBE_NOTIFY_SUBSCRIBERS=false
# YOUTUBE_MADE_FOR_KIDS=false
YOUTUBE_PROCESSING_TIMEOUT_MS=600000
# GALLERY_STATE_PATH=/persistent/path/gallery-upload-state.json

# Tylko tymczasowo przy pierwszej autoryzacji Gmaila.
GMAIL_AUTH_CODE=oauth_code_from_google_redirect
```

Znaczenie zmiennych:

- `BOT_TOKEN` - token bota z Discord Developer Portal.
- `CLIENT_ID` - application/client ID aplikacji Discord, używane przy rejestracji
  komend.
- `GUILD_ID` - ID serwera Discord, na którym rejestrowane są komendy.
- `OPENAI_API_KEY` - klucz API OpenAI dla asystenta AI.
- `WELCOME_CHANNEL_ID` - kanał powitań nowych członków.
- `MEDIA_CHANNEL_ID` - kanał, na którym bot przechwytuje obrazy/wideo do uploadu
  na Drive.
- `FAKTURY_CHANNEL_ID` - kanał powiadomień o nowych mailach fakturowych.
- `SHARED_DRIVE_ID` - ID folderu/dysku Google Drive, w którym bot listuje i
  tworzy foldery dla mediów.
- `GALLERY_API_BASE_URL` - adres strony; domyślnie `https://warsztatmiejski.org`.
- `GALLERY_DISCORD_INGEST_SECRET` - sekret Bearer współdzielony wyłącznie
  przez bota i API strony; musi odpowiadać zmiennej o tej samej nazwie na stronie.
- `GALLERY_MAX_IMAGE_BYTES` - lokalny limit obrazu odpowiadający limitowi strony;
  domyślnie 20 MB.
- `GALLERY_MAX_DISCORD_VIDEO_BYTES` - limit filmu po obu stronach; domyślnie
  20 MB.
- `GALLERY_API_TIMEOUT_MS` - domyślny limit czasu wywołań API galerii i wartość
  zapasowa dla obu etapów obsługi obrazu; domyślnie 120 sekund.
- `GALLERY_IMAGE_DOWNLOAD_TIMEOUT_MS` i `GALLERY_IMAGE_UPLOAD_TIMEOUT_MS` -
  niezależne limity pobrania obrazu z Discorda i wysłania gotowego multipart do
  strony.
- `GALLERY_API_RETRY_COUNT` - liczba ponowień po przejściowym błędzie połączenia
  albo HTTP 502/503/504; domyślnie 2 (łącznie najwyżej 3 próby).
- `GALLERY_API_RETRY_DELAY_MS` - początkowe opóźnienie ponowienia; domyślnie
  500 ms i podwaja się przy każdej kolejnej próbie.
- `YOUTUBE_CHANNEL_ID` - oczekiwany kanał. Bot odmawia uploadu, jeśli token OAuth
  został wystawiony dla innego kanału.
- `YOUTUBE_PLAYLIST_ID` - zwykła playlista, do której bot dodaje nowe filmy.
- `YOUTUBE_CREDENTIALS_PATH` - opcjonalna ścieżka do osobnego klienta OAuth dla
  YouTube; domyślnie wspólny `credentials.json` w katalogu bota.
- `YOUTUBE_TOKEN_PATH` - opcjonalna trwała lokalizacja tokenu YouTube; domyślnie
  `token_youtube.json` w katalogu bota.
- `YOUTUBE_REDIRECT_URI` - redirect URI klienta OAuth; domyślnie
  `http://localhost:3000/oauth2callback` i musi dokładnie odpowiadać wpisowi w
  Google Cloud Console.
- `YOUTUBE_PRIVACY_STATUS` - domyślnie `unlisted`.
- `YOUTUBE_CATEGORY_ID` - domyślnie `22` (`People & Blogs`).
- `YOUTUBE_NOTIFY_SUBSCRIBERS` - domyślnie `false`.
- `YOUTUBE_MADE_FOR_KIDS` - opcjonalne jawne ustawienie odbiorców filmu. Gdy
  zmienna nie istnieje, bot nie wysyła tego pola i obowiązują ustawienia kanału.
- `YOUTUBE_PROCESSING_TIMEOUT_MS` - jak długo bot czeka na zakończenie
  przetwarzania filmu przed publikacją rekordu strony; domyślnie 10 minut.
- `GALLERY_STATE_PATH` - opcjonalna trwała lokalizacja stanu uploadów; domyślnie
  `gallery-upload-state.json` w katalogu bota.
- `GMAIL_AUTH_CODE` - jednorazowy kod OAuth do wygenerowania `token_gmail.json`.
  Po poprawnej autoryzacji usuń tę zmienną z `.env`.

## Pliki Google OAuth

Integracje Google wymagają pliku z OAuth Client ID pobranego z Google Cloud
Console. Drive i Gmail domyślnie korzystają z lokalnego `credentials.json`.
YouTube może korzystać z osobnego klienta wskazanego przez
`YOUTUBE_CREDENTIALS_PATH`, co jest zalecane, gdy uploader ma osobny projekt
Google Cloud objęty audytem YouTube.

W Google Cloud należy włączyć:

- Google Drive API dla uploadu mediów.
- Gmail API dla sprawdzania nieprzeczytanych maili.
- YouTube Data API v3 dla uploadu filmów i zarządzania playlistą.

OAuth client musi mieć redirect URI:

```text
http://localhost:3000/oauth2callback
```

Tokeny generowane lokalnie:

- `token_drive.json` - token Google Drive, generowany automatycznie przy pierwszym
  użyciu uploadu mediów.
- `token_gmail.json` - token Gmaila, generowany po podaniu `GMAIL_AUTH_CODE`.
- `token_youtube.json` - oddzielny token YouTube z uprawnieniami do uploadu i
  zarządzania playlistą; jest generowany przy pierwszym filmie galeryjnym.
- `token.json` - starszy token Google Photos, używany tylko przez
  `googlePhotos.js`, który obecnie nie jest podpięty w głównym flow bota.

Tych plików nie należy commitować. Jeżeli przenosisz bota na inny serwer, skopiuj
je bezpiecznym kanałem albo wykonaj autoryzację ponownie.

Nowe projekty YouTube API bez audytu ograniczają uploady API do widoczności
prywatnej, nawet gdy bot prosi o `unlisted`. Przed produkcyjnym uruchomieniem
galerii projekt Google Cloud musi przejść wymagany audyt YouTube. Zewnętrzna
aplikacja OAuth pozostawiona w trybie `Testing` wydaje ponadto token odświeżania
ważny tylko 7 dni; konfiguracja produkcyjna nie może pozostać w tym trybie.

## Konfiguracja Discorda

W Discord Developer Portal dla aplikacji bota włącz wymagane privileged intents:

- Server Members Intent - potrzebny do powitań nowych członków.
- Message Content Intent - potrzebny do reakcji na słowa kluczowe, uploadu mediów
  i obsługi wzmianek AI.

Bot korzysta również ze standardowego intentu `Guild Message Reactions`, aby
obsługiwać reakcje `:gallery:` także dla wiadomości, których nie ma w cache.

Bot wymaga uprawnień na serwerze odpowiednich do używanych funkcji:

- czytanie wiadomości i historii wiadomości,
- wysyłanie wiadomości i embedów,
- zarządzanie wiadomościami, aby móc usunąć reakcję `:gallery:` po nieudanym
  uploadzie oraz oryginał przy `/move delete_original:true`,
- używanie slash commands,
- zarządzanie webhookami dla `/move`,
- dostęp do kanałów zdefiniowanych w `.env`.

Po zmianie komend uruchom:

```bash
node deploy-commands.js
```

Komendy są rejestrowane per `GUILD_ID`, więc aktualizacje na serwerze testowym i
produkcyjnym wymagają właściwego `.env`.

## Konfiguracja `config.json`

`config.json` jest normalnym plikiem repozytorium i zawiera ustawienia, które nie
są sekretami:

- `keywordsEnabled` - stan reakcji na słowa kluczowe. Komenda `/reakcje` zapisuje
  zmianę bezpośrednio do tego pliku.
- `systemPrompt` - główny prompt asystenta AI. Trustee może go podejrzeć lub
  zmienić przez `/kontekst`.
- `roleIds.trustee` i `roleIds.premium` - ID ról Discorda używane do uprawnień i
  limitów AI.
- `gallery.emojiName` - nazwa niestandardowego emoji uruchamiającego upload do
  galerii; domyślnie `gallery` (bez dwukropków).
- `calendarChannelId` - kanał kalendarza linkowany w odpowiedziach o wydarzeniach.
- `memoryTurns` - liczba tur rozmowy pamiętanych per kanał w pamięci procesu.
- `dailyBudgetUSD` - globalny dzienny limit kosztów AI.
- `perRoleDailyLimits` - dzienne limity per użytkownik zależnie od roli.
- `pricing` - ceny modeli używane do lokalnego liczenia kosztów.
- `model` - model OpenAI używany przez asystenta.

Po zmianie ID ról lub kanałów upewnij się, że bot widzi te role/kanały na
docelowym serwerze.

## Uruchomienie lokalne

1. Zainstaluj zależności:

```bash
npm install
```

2. Utwórz `.env` i `credentials.json`.

3. Zarejestruj komendy na serwerze Discord:

```bash
node deploy-commands.js
```

4. Uruchom bota:

```bash
npm start
```

Autoryzację YouTube można przygotować przed uruchomieniem bota:

```bash
npm run youtube:auth
```

Przy pierwszym użyciu Google Drive lub YouTube bot otworzy URL autoryzacyjny i
nasłuchuje callbacku na `localhost:3000`. Dla YouTube należy zalogować się jako
osoba zarządzająca kanałem wskazanym przez `YOUTUBE_CHANNEL_ID`. Na serwerze bez
przeglądarki wygeneruj `token_youtube.json` lokalnie z tym samym `credentials.json`,
a następnie skopiuj token bezpiecznym kanałem. Przy pierwszym użyciu Gmaila
`gmail.js` wypisze w
logach ręczną instrukcję: wejdź w URL, zaloguj się jako konto fakturowe, skopiuj
parametr `code`, wpisz go jako `GMAIL_AUTH_CODE` w `.env` i zrestartuj bota. Po
utworzeniu `token_gmail.json` usuń `GMAIL_AUTH_CODE`.

## Wdrożenie na serwerze

`start_bot.sh` jest dopasowany do obecnej ścieżki produkcyjnej:

```text
/home/warsztatmiejski/domains/dev.warsztatmiejski.org/public_nodejs/discord/
```

Skrypt:

- zakłada lock w `/tmp/discord-bot.lockfile`, żeby nie uruchomić dwóch instancji,
- ładuje `.env`,
- sprawdza, czy działa `node index.js`,
- uruchamia bota przez `/usr/local/bin/node`.

Jeżeli projekt trafia na inną maszynę albo do innej ścieżki, zaktualizuj ścieżki
w `start_bot.sh`. Na serwerze muszą istnieć `.env`, `credentials.json` oraz
wygenerowane tokeny Google albo możliwość wykonania autoryzacji od nowa.

## Pliki stanu i dane lokalne

- `cost-tracker.json` - dzienne koszty AI per użytkownik i globalnie.
- `last_email_check.json` - ostatnio przetworzone ID maili, żeby nie wysyłać
  duplikatów powiadomień.
- `token_drive.json`, `token_gmail.json`, `token_youtube.json`, `token.json` -
  tokeny OAuth Google.
- `gallery-upload-state.json` - lokalne mapowanie Discord attachment ID na ID
  filmu i elementu playlisty YouTube. Plik należy zachować przy migracji bota.
- `config.json` - część ustawień może być zmieniana przez komendy bota.

Te pliki wpływają na zachowanie działającej instancji. Przed restartem lub
migracją serwera zdecyduj, które z nich trzeba zachować.

## Komendy i interakcje

- `/reakcje` - włącza lub wyłącza reakcje na słowa kluczowe.
- `/ludzie` - pokazuje liczbę użytkowników serwera.
- `/koszty` - pokazuje dzisiejsze zużycie AI globalnie i dla użytkownika.
- `/faktury` - ręcznie sprawdza nowe maile; wymaga roli `trustee`.
- `/kontekst [newprompt]` - pokazuje albo aktualizuje prompt systemowy AI; wymaga
  roli `trustee`.
- `/move target delete_original` - przenosi wskazaną wiadomość do kanału przez
  webhook. Obecna implementacja oczekuje wiadomości źródłowej dostępnej w
  kontekście interakcji.
- `Move` - menu kontekstowe wiadomości; obecnie odsyła do użycia `/move`.
- `Reply as Bot` - menu kontekstowe wiadomości, otwiera modal i odpowiada botem
  pod wskazaną wiadomością.

### Upload do galerii przez reakcję

1. Wiadomość musi zawierać co najmniej jeden załącznik typu obraz lub wideo.
2. Użytkownik z rolą określoną w `roleIds.trustee` dodaje do wiadomości
   niestandardową reakcję określoną przez `gallery.emojiName` (domyślnie
   `:gallery:`).
3. Dla obrazu bot pobiera tymczasowy załącznik Discorda i umieszcza import w
   globalnej kolejce. API strony otrzymuje tylko jeden obraz naraz, tworzy jego
   warianty, zapisuje je w R2 i publikuje rekord galerii.
4. Dla filmu bot rezerwuje rekord strony, wykonuje wznawialny upload do YouTube,
   dodaje film do skonfigurowanej playlisty i finalizuje rekord strony linkiem
   YouTube. Pomyślne przetwarzanie zdjęć i filmów nie publikuje wiadomości na
   Discordzie.
5. Każdy załącznik jest identyfikowany przez Discord attachment ID, więc kolejne
   reakcje nie powodują ponownego uploadu tego samego pliku.

Jeśli którykolwiek załącznik zawiedzie, bot usuwa reakcję użytkownika i odpowiada
komunikatem o błędzie. Poprawnie przetworzone załączniki pozostają zapisane, więc
ponowna reakcja może dokończyć pozostałe bez duplikowania wcześniejszych uploadów.
Lokalny stan pozwala też dokończyć playlistę lub API strony bez drugiego uploadu
filmu do YouTube.

## Uwagi utrzymaniowe

- Bot trzyma pamięć rozmowy AI tylko w pamięci procesu. Restart czyści kontekst
  rozmów, ale nie czyści `cost-tracker.json`.
- Harmonogram Gmaila opiera się na czasie systemowym serwera.
- Gmail pobiera nieprzeczytane wiadomości (`is:unread`), ale ich nie oznacza jako
  przeczytane. Duplikaty są ograniczane przez `last_email_check.json`.
- OpenAI koszt jest liczony lokalnie z `config.json`; po zmianie modelu albo cen
  trzeba zaktualizować sekcję `pricing`.
- `npm test` uruchamia testy Node.js dla filtrowania załączników, kontraktu API
  strony, trwałego stanu, koordynacji reakcji oraz pomocniczej logiki YouTube.
