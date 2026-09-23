# Instrukcja uzupełnienia — nie publikować jako części regulaminu

Przygotowano 21 września 2026 r. na podstawie kodu i README tego repozytorium oraz źródeł wskazanych poniżej. Są to rozbudowane projekty do dostosowania, nie opinia prawna ani potwierdzenie zgodności aplikacji przez Google. Weryfikację podstaw przetwarzania, licencji, wizerunku i obowiązków konsumenckich warto powierzyć prawnikowi znającemu model działania organizacji.

## Pliki

- `polityka-prywatnosci.md` — projekt polityki całego Bota, obejmujący także AI, Drive i Gmail.
- `regulamin-aplikacji.md` — projekt warunków korzystania dla ograniczonej społeczności.

`[UZUPEŁNIJ: ...]` oznacza brakujące dane lub decyzję. `[POTWIERDŹ: ...]` oznacza fakt lub procedurę wymagającą sprawdzenia. Wszystkie te oznaczenia trzeba rozstrzygnąć przed publikacją. Jeżeli funkcja jest wyłączona, usuń jej opis konsekwentnie z obu dokumentów. Jeżeli aplikacja Google obejmuje wyłącznie uploader YouTube, opis zakresu tej aplikacji musi być jednoznaczny; nie sugeruj, że dana autoryzacja daje też dostęp do Gmaila lub AI.

## Dane i decyzje do zebrania

1. Pełne dane operatora i administratora danych — nazwa społeczności sama w sobie nie identyfikuje podmiotu odpowiedzialnego; adres, forma prawna, właściwe numery rejestrowe, e-mail, ewentualny IOD.
2. Publiczne adresy strony aplikacji, polityki i regulaminu; nazwa serwera, kanału YouTube, playlisty i adres galerii.
3. Włączone funkcje, grupy odbiorców danych, minimalny wiek, odpłatność i status operatora.
4. Dostawcy i właściwe podmioty umowne, kraje przetwarzania oraz dokumentacja transferów poza EOG.
5. Konkretne okresy retencji i sposób ich wykonywania, w tym logi, historia kosztów, dane AI, powiadomienia Gmail, kopie zapasowe i stan uploadów. Nie wpisuj okresów, których nie potrafisz dotrzymać.
6. Podstawy prawne, procedura pozyskiwania praw do materiałów oraz zgód na publikację danych i wizerunku. Ustal także sposób przekazywania informacji osobom niebędącym użytkownikami Bota, np. osobom widocznym na zdjęciach i nadawcom e-maili.
7. Mechanizm akceptacji dokumentów, zgłaszania publikacji, reklamacji, odłączenia integracji i usunięcia materiałów; terminy odpowiedzi i osoba obsługująca zgłoszenia.
8. Osobna polityka strony galerii albo rozszerzenie projektu o faktyczne cookies, odtwarzacze, reklamy, analitykę i dane odwiedzających. Tych ustawień nie ustalono w repozytorium Bota.

## Ustalenia techniczne wymagające uwagi przed publikacją

- **Logowanie:** `index.js` zapisuje nazwę autora i treść odbieranych wiadomości przed sprawdzeniem, czy dotyczą Bota. Projekt ujawnia ten fakt. Ustal, czy takie logowanie jest potrzebne, ogranicz je i dopiero potem dostosuj opis. Sam dokument nie uzasadnia nadmiernego zbierania danych.
- **Kontekst AI:** `ai.js` ma lokalną pamięć według kanału, lecz jeden wspólny `lastRespId` przekazywany jako `previous_response_id`. Stwarza to ryzyko powiązania kontekstu między kanałami. Nie deklaruj izolacji kanałów bez naprawy i sprawdzenia. W projekcie pozostawiono pole wymagające doprecyzowania; nie zmieniano kodu w ramach przygotowania dokumentów.
- **Powiadomienia Gmail:** nadawca, temat i podgląd trafiają na Discord. Sprawdź odbiorców kanału i możliwość odczytania powiadomień przez AI przy kolejnych interakcjach. Nie deklaruj bezwarunkowo, że dane Gmail nigdy nie mogą trafić do AI, zanim rozdzielenie nie zostanie zapewnione.
- **Dostęp OAuth:** kod Drive żąda również szerokiego zakresu `drive`, Gmail — `gmail.readonly`, a YouTube — `youtube.force-ssl`. Opis rzeczywiście wykonywanych czynności nie oznacza, że zakresy OAuth są technicznie ograniczone tylko do tych czynności. Zweryfikuj minimalność uprawnień i zgodność opisu ekranu zgody.
- **Publikacja:** reakcja `gallery` jest kontrolą uprawnień operatora, a nie rejestrem licencji lub zgód osób przedstawionych. Dokument wymaga uzupełnienia faktycznego sposobu pozyskania upoważnienia. Przed uploadem powinny być jasne docelowy kanał, odbiorcy i publikowane metadane; sprawdź także wymagania interfejsu YouTube.
- **Akceptacja:** w przejrzanym przepływie galerii nie ma etapu akceptacji dokumentów. Można go zorganizować w procesie nadawania dostępu, lecz trzeba wskazać i wdrożyć rzeczywisty mechanizm. Potwierdzenie zapoznania z polityką nie jest zgodą na wszystkie operacje RODO.
- **Usuwanie i retencja:** nie potwierdzono automatycznego procesu odświeżania/usuwania danych YouTube, obsługi cofnięcia dostępu ani rotacji wszystkich zapisów. Terminy opisane w projekcie wymagają działania operacyjnego lub zmian technicznych. Sam restart nie usuwa plików stanu ani danych u dostawców. Przy lokalnym odłączaniu autoryzacji uwzględnij również unieważnienie tokenu w Google.
- **Materiały na wielu platformach:** usunięcie źródła z Discorda nie usuwa pliku z R2, Drive ani filmu YouTube. Przygotuj procedurę obejmującą wszystkie kopie pod kontrolą operatora, CDN i odtworzenia z backupów.

To instrukcje redakcyjne i wdrożeniowe, a nie potwierdzenie, że te procedury już działają. Projektów nie należy publikować z nierozstrzygniętymi obietnicami dotyczącymi procesu.

## Publikacja

Po uzupełnieniu usuń komunikaty o projekcie i wszystkie oznaczenia edytorskie. Opublikuj oba dokumenty jako czytelne strony HTTPS dostępne bez logowania, np. pod `/bot/polityka-prywatnosci` i `/bot/regulamin`. Dodaj odnośniki na stronie aplikacji, w informacji o Bocie i w procesie udostępniania funkcji. Wpisz odpowiednie adresy w konfiguracji Google OAuth. Publiczność dokumentów nie zmienia uprawnień do używania Bota.

Zachowuj wersje dokumentów i daty ich obowiązywania. Nie publikowano ani nie wdrażano tych projektów automatycznie.

## Źródła wykorzystane do przygotowania projektu

- [YouTube API Services — Developer Policies](https://developers.google.com/youtube/terms/developer-policies): wymagania dotyczące dokumentów, upoważnień i cyklu życia danych API.
- [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy): dopuszczalne wykorzystanie i udostępnianie danych Google.
- [RODO — polski tekst w EUR-Lex](https://eur-lex.europa.eu/legal-content/PL/TXT/?uri=CELEX%3A32016R0679): podstawy przetwarzania, obowiązki informacyjne, prawa osób i transfery danych.
- [UODO — prawa osób](https://uodo.gov.pl/pl/493/2254): elementy informacji o przetwarzaniu i prawa osób.
- [UODO — określanie okresów przechowywania](https://uodo.gov.pl/pl/676/4260): okres lub zrozumiałe kryterium retencji.
- [Ustawa o świadczeniu usług drogą elektroniczną — tekst jednolity z 2024 r.](https://eli.gov.pl/api/acts/DU/2024/1513/text.html): zakres regulaminu i informowanie o usługodawcy; przed publikacją zweryfikuj także późniejsze zmiany i przepisy właściwe dla konkretnego modelu usługi.

Źródła pomagają dostosować dokumenty, ale sam tekst nie gwarantuje uzyskania weryfikacji OAuth, audytu YouTube ani spełnienia wszystkich wymagań prawnych i technicznych.
