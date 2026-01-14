# Discord Bot Warsztatu Miejskiego

Bot Discord dla społeczności Warsztatu Miejskiego. Łączy automatyzacje serwerowe,
asystenta AI oraz integracje z usługami Google (Drive i Gmail), wspierając codzienną
obsługę społeczności i pracowni.

## Funkcje

- Asystent AI uruchamiany przez wzmiankę bota, z pamięcią kontekstu rozmowy,
  wsparciem dla obrazów, narzędziami web_search i code_interpreter oraz wstrzykiwaniem
  wiedzy z lokalnej bazy Warsztatu.
- Limity i budżet AI: dzienny limit globalny oraz per‑rola; śledzenie kosztów per
  użytkownik i dzień (cost‑tracker).
- Skrót do wydarzeń: przy wzmiance i zapytaniu o „wydarzenia” bot zwraca listę
  nadchodzących eventów i link do kanału kalendarza.
- Powitania nowych członków na wskazanym kanale.
- Reakcje na słowa kluczowe (możliwe do włączenia/wyłączenia), z cooldownem 72h
  na daną odpowiedź.
- Komendy administracyjne i informacyjne (patrz sekcja „Komendy i interakcje”).
- Przenoszenie wiadomości: /move repostuje wiadomość do innego kanału przez webhook,
  zachowuje autora, avatar, załączniki i opcjonalnie usuwa oryginał.
- Kontekstowe „Reply as Bot”: menu kontekstowe na wiadomości z modalem do wpisania
  odpowiedzi bota.
- Obsługa mediów: w wyznaczonym kanale bot prosi o wybór folderu w Google Drive,
  umożliwia utworzenie nowego folderu i wgrywa obrazy/wideo z metadanymi autora.
- Sprawdzanie maili faktury@warsztatmiejski.org przez Gmail: automatyczne odpytywanie
  o 9:00/13:00/17:00, powiadomienia na kanale oraz ręczne wywołanie przez komendę.
- Ochrona przed duplikatami powiadomień mailowych dzięki zapisywaniu ostatnich
  przetworzonych wiadomości.

## Komendy i interakcje

- /reakcje – włącz/wyłącz reakcje na słowa kluczowe.
- /ludzie – podaj liczbę użytkowników serwera.
- /koszty – pokaż dzisiejsze zużycie AI (globalne i per użytkownik).
- /faktury – ręczne sprawdzenie nowych maili (tylko rola trustee).
- /kontekst – podgląd lub edycja promptu systemowego AI (tylko rola trustee).
- /move – przenieś wiadomość (odpowiedz na nią i wskaż kanał docelowy).
- Menu kontekstowe: „Move” oraz „Reply as Bot”.
