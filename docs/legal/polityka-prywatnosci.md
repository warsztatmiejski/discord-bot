# Polityka prywatności aplikacji „Św. MacGyver”

Wersja: [UZUPEŁNIJ: numer wersji]. Data obowiązywania: [UZUPEŁNIJ: data].

> PROJEKT DO UZUPEŁNIENIA. Przed publikacją należy uzupełnić wszystkie oznaczenia [UZUPEŁNIJ] i [POTWIERDŹ], usunąć nieużywane funkcje oraz ten komunikat. Dokument opisuje bota Warsztatu Miejskiego; nie zastępuje polityki prywatności całej strony internetowej.

## 1. Administrator i kontakt

Administratorem danych osobowych przetwarzanych w związku z działaniem aplikacji „Św. MacGyver”, dalej „Aplikacja” lub „Bot”, jest [UZUPEŁNIJ: pełna nazwa podmiotu albo imię i nazwisko osoby prowadzącej usługę, forma prawna], z adresem [UZUPEŁNIJ: adres], [UZUPEŁNIJ: odpowiednie dane rejestrowe, jeżeli dotyczą], dalej „Administrator”. Warsztat Miejski jest nazwą społeczności, dla której działa Aplikacja.

Kontakt w sprawach danych osobowych, usunięcia materiałów i działania Aplikacji: [UZUPEŁNIJ: e-mail].

Inspektor ochrony danych: [UZUPEŁNIJ: dane kontaktowe IOD, jeżeli został wyznaczony; w przeciwnym razie usuń ten akapit].

Informacje o Aplikacji: [UZUPEŁNIJ: publiczny URL strony Aplikacji]. Regulamin: [UZUPEŁNIJ: URL regulaminu].

## 2. Zakres dokumentu

Aplikacja wspiera upoważnionych członków społeczności Warsztatu Miejskiego na serwerze Discord [UZUPEŁNIJ: nazwa serwera]. Nie jest usługą, do której każdy otrzymuje dostęp przez samo odwiedzenie strony Aplikacji.

Polityka obejmuje dane użytkowników Discorda, osób widocznych lub wymienionych w materiałach, osób prowadzących korespondencję z obsługiwaną skrzynką oraz osób autoryzujących integracje Google.

Bot udostępnia funkcje organizacyjne i administracyjne, asystenta AI, przesyłanie mediów do Google Drive, publikowanie zdjęć w galerii i filmów w YouTube oraz powiadomienia o poczcie Gmail. [POTWIERDŹ: które funkcje są włączone w produkcji; usuń z całego dokumentu opisy funkcji niewykorzystywanych].

Discord, Google/YouTube i inni dostawcy przetwarzają także dane w ramach własnych usług. Niniejszy dokument opisuje działania Administratora i integracje Aplikacji, a nie wszystkie operacje tych dostawców.

## 3. Jakie dane przetwarzamy i skąd je otrzymujemy

### 3.1. Discord i funkcje organizacyjne

Otrzymujemy od Discorda dane udostępniane Botowi w ramach jego uprawnień: identyfikator użytkownika, nazwę użytkownika i nazwę wyświetlaną, avatar, role i informacje o członkostwie, treści wiadomości, załączniki, reakcje, wywołania komend, identyfikatory serwerów, kanałów i wiadomości, daty, odnośniki do wiadomości oraz dane wydarzeń dostępnych na serwerze.

Zakres widoczności zależy od uprawnień Bota. Odczyt wiadomości może następować także bez oznaczenia Bota, między innymi w celu obsługi słów kluczowych i załączników. Obecna konfiguracja zapisuje w logach nazwę autora i treść wiadomości odbieranych przez Bota. [POTWIERDŹ: zakres logowania po wdrożeniu i ograniczenia dostępu].

Przeniesienie wiadomości przez upoważnioną osobę może skopiować jej treść, nazwę i avatar autora, załączniki oraz odnośnik do źródła do innego kanału. Odbiorcami kopii będą osoby mające dostęp do kanału docelowego.

### 3.2. Zdjęcia, filmy i galeria

Przetwarzamy przesłane pliki oraz ich nazwy, typ, rozmiar i zawarte w nich informacje. Materiały mogą przedstawiać wizerunek, głos, prace lub inne informacje o osobach. Źródłem danych może być autor wiadomości, osoba przesyłająca materiał albo osoba zatwierdzająca publikację.

Z materiałem wiążemy dane autora na Discordzie, kanału i wiadomości źródłowej, czas utworzenia oraz identyfikatory potrzebne do obsługi publikacji i zapobiegania duplikatom. System przechowuje również status przetwarzania, identyfikator filmu i elementu playlisty oraz adres opublikowanego materiału.

Zdjęcia wybrane do galerii trafiają do infrastruktury strony i magazynu Cloudflare R2. Filmy trafiają na kanał YouTube [UZUPEŁNIJ: nazwa i URL kanału], a odnośniki do nich do galerii [UZUPEŁNIJ: URL].

Tytuł filmu może zawierać pierwszą linię wiadomości z Discorda albo nazwę pliku. Opis filmu zawiera nazwę autora i jego nazwę użytkownika, nazwę kanału Discord oraz odnośnik do wiadomości źródłowej. Nie należy umieszczać w tych polach informacji, które nie powinny być ujawniane odbiorcom filmu.

Widoczność galerii: [UZUPEŁNIJ: publiczna lub dokładnie określona grupa odbiorców]. Widoczność filmów: [UZUPEŁNIJ: rzeczywista konfiguracja]. Film „niepubliczny” w YouTube może obejrzeć i udostępnić dalej osoba posiadająca odnośnik. Umieszczenie go w publicznej galerii nie zapewnia poufności.

### 3.3. Google Drive

Po uruchomieniu funkcji przesyłania mediów zapisujemy wybrane zdjęcia lub filmy w folderze Google Drive wskazanym albo utworzonym w ramach interakcji z Botem, wraz z metadanymi autora i pochodzenia. Przetwarzamy także nazwy i identyfikatory folderów oraz plików.

Dostęp do tych materiałów mają [UZUPEŁNIJ: rzeczywista grupa odbiorców i zasady udostępniania folderów, w tym ewentualny dostęp przez link].

### 3.4. Asystent AI

Skorzystanie z asystenta może przekazać do OpenAI treść skierowanego do niego zapytania, dołączony obraz, kontekst wcześniejszej rozmowy i odpowiedzi oraz dobrane informacje z bazy wiedzy Warsztatu. Asystent może korzystać z narzędzi wyszukiwania internetowego i analizy danych.

Odpowiedzi pojawiają się na kanale wywołania i są dostępne jego odbiorcom. Kontekst może zawierać wypowiedzi innych uczestników. [UZUPEŁNIJ po sprawdzeniu konfiguracji: dokładne granice współdzielenia historii między użytkownikami i kanałami oraz zasady retencji po stronie dostawcy].

Przechowujemy identyfikator użytkownika oraz dzienne zestawienia zużycia i kosztów, aby stosować limity. Nie należy przesyłać do asystenta haseł, tokenów, poufnej korespondencji ani danych osób trzecich bez odpowiedniego uprawnienia.

### 3.5. Gmail

Integracja dotyczy skrzynki organizacyjnej [UZUPEŁNIJ: adres lub jednoznaczny opis skrzynki], autoryzowanej przez uprawnioną osobę. Nie wymaga podłączania prywatnych skrzynek członków Discorda.

Bot pobiera informacje o nieprzeczytanych wiadomościach: identyfikator, nadawcę, temat, datę i fragment treści. Powiadomienia z tymi informacjami publikuje na kanale [UZUPEŁNIJ: nazwa i uprawniona grupa odbiorców]. Dotyczy to także danych osób, które nie korzystają z Discorda, lecz wysłały wiadomość na tę skrzynkę.

Bot zapisuje identyfikatory ostatnio obsłużonych wiadomości, aby ograniczać powtórne powiadomienia. Dalsze przechowywanie samej korespondencji i dokumentów księgowych podlega [UZUPEŁNIJ: odnośnik do właściwej informacji o przetwarzaniu danych lub opis zasad].

### 3.6. Upoważnienia Google, obsługa i bezpieczeństwo

Przechowujemy tokeny autoryzacyjne umożliwiające wykonywanie zatwierdzonych czynności w usługach Google, a także dane o kanale, plikach i operacjach niezbędne dla danej integracji. Aplikacja nie wymaga przekazania nam hasła do konta Google; logowanie odbywa się po stronie Google.

Przetwarzamy również korespondencję ze zgłoszeń, informacje o błędach i operacjach oraz dane techniczne infrastruktury [UZUPEŁNIJ: faktycznie gromadzone kategorie, w tym adresy IP, jeżeli występują].

## 4. Cele i podstawy prawne

Dane przetwarzamy wyłącznie w zakresie odpowiednim do konkretnego celu. Podstawy prawne odnoszą się do RODO, czyli rozporządzenia (UE) 2016/679.

| Cel | Podstawa i zakres |
| --- | --- |
| Wykonanie funkcji zamówionej przez użytkownika, np. odpowiedź Bota lub zapis jego pliku | Art. 6 ust. 1 lit. b RODO — w zakresie obiektywnie niezbędnym do realizacji usługi na rzecz tej osoby. |
| Zarządzanie dostępem, organizacja społeczności, zapobieganie nadużyciom i kontrola kosztów | Art. 6 ust. 1 lit. f RODO — uzasadniony interes polegający na bezpiecznym i sprawnym prowadzeniu społeczności. [POTWIERDŹ: zakres po ocenie interesów i ograniczeniu danych]. |
| Diagnostyka i logi | [UZUPEŁNIJ: uzasadniony, niezbędny zakres i podstawa; samo wpisanie tego celu nie uzasadnia zapisywania wszystkich wiadomości]. |
| Publiczna publikacja materiałów i danych autora, w tym wizerunku | [UZUPEŁNIJ: konkretna podstawa dla poszczególnych kategorii i sposób jej dokumentowania; jeżeli zgoda — art. 6 ust. 1 lit. a RODO]. Niezależnie ustalamy uprawnienia autorskie i podstawę rozpowszechniania wizerunku. |
| Obsługa korespondencji organizacyjnej i powiadomień Gmail | [UZUPEŁNIJ: właściwa podstawa stosownie do rodzaju spraw; np. art. 6 ust. 1 lit. f RODO dla sprawnej obsługi korespondencji]. |
| Odpowiedzi na zgłoszenia i reklamacje | Art. 6 ust. 1 lit. b RODO w sprawach usługi użytkownika; art. 6 ust. 1 lit. f RODO w pozostałych sprawach wymagających kontaktu. |
| Wypełnienie obowiązków prawnych | Art. 6 ust. 1 lit. c RODO — wyłącznie gdy konkretny obowiązek ma zastosowanie: [UZUPEŁNIJ: obowiązek i przepis albo usuń nieaktualny zakres]. |
| Ustalenie, dochodzenie lub obrona roszczeń | Art. 6 ust. 1 lit. f RODO — ochrona praw Administratora lub innych osób, w niezbędnym zakresie. |

Akceptacja Regulaminu, autoryzacja OAuth i zgoda na przetwarzanie danych to różne czynności. Korzystanie z Discorda ani reakcja moderatora nie zastępują zgody osoby przedstawionej w materiale, jeżeli jest ona wymagana. Zgody uzyskujemy odrębnie, dla określonych celów.

Podanie danych jest co do zasady dobrowolne, lecz bez informacji niezbędnych do danej funkcji nie możemy jej wykonać. Odmowa opcjonalnej publikacji materiału nie oznacza zgody na publikację i nie pozbawia automatycznie dostępu do pozostałych funkcji.

## 5. Odbiorcy danych

Dostęp do danych mogą otrzymywać upoważnione osoby obsługujące Aplikację oraz dostawcy niezbędni do jej działania:

| Odbiorca lub usługa | Powód przekazania |
| --- | --- |
| Discord | Obsługa interakcji, wiadomości, powiadomień i załączników. |
| Google — YouTube, Drive, Gmail | Publikacja filmów, przechowywanie mediów, odczyt powiadomień pocztowych oraz autoryzacja. |
| Cloudflare R2 i infrastruktura galerii | Przechowywanie i udostępnianie zdjęć oraz obsługa rekordów galerii. |
| OpenAI | Realizacja zapytań do asystenta AI i używanych przez niego narzędzi. |
| [UZUPEŁNIJ: hosting Bota, strony, bazy danych, kopii zapasowych i pozostali dostawcy] | [UZUPEŁNIJ: usługa i zakres danych]. |

[POTWIERDŹ: pełne nazwy podmiotów zgodnie z zawartymi umowami oraz ich role jako podmiotów przetwarzających lub niezależnych administratorów].

Odbiorcami są także osoby mające dostęp do kanału Discord, folderu Drive lub opublikowanego materiału. Publiczna galeria może być dostępna dla nieograniczonego kręgu osób. Dane udostępniamy organom publicznym tylko wtedy, gdy istnieje ku temu podstawa prawna.

Nie sprzedajemy danych użytkowników ani nie wykorzystujemy danych otrzymanych przez Google API do targetowania reklam. Korzystanie i przekazywanie informacji z Google API podlega [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), w tym wymaganiom Limited Use, gdy mają zastosowanie.

Dostęp ludzi do danych z Google API ograniczamy do dozwolonych przypadków, w szczególności wyraźnie zatwierdzonej obsługi danej funkcji, bezpieczeństwa lub obowiązku prawnego. [POTWIERDŹ przed publikacją: zgody na powiadomienia Gmail, osoby z dostępem i rozdzielenie tych danych od funkcji AI].

## 6. Przekazywanie danych poza EOG

Korzystanie z międzynarodowych dostawców może wiązać się z przetwarzaniem danych poza Europejskim Obszarem Gospodarczym, w tym w Stanach Zjednoczonych.

[UZUPEŁNIJ dla każdego właściwego dostawcy: państwa lub sposób ich ustalenia, podstawę transferu — np. właściwą decyzję stwierdzającą odpowiedni stopień ochrony albo standardowe klauzule umowne — oraz dostęp do informacji o zabezpieczeniach. Nie wpisuj udziału dostawcy w EU–US Data Privacy Framework bez sprawdzenia właściwego podmiotu i zakresu certyfikacji].

Informacje o zastosowanych zabezpieczeniach i możliwość otrzymania ich kopii, z uwzględnieniem ochrony tajemnic i danych innych osób, można uzyskać pod adresem kontaktowym Administratora.

## 7. Okresy przechowywania

Stosujemy następujące okresy lub jednoznaczne kryteria:

| Kategoria | Okres lub kryterium |
| --- | --- |
| Logi, w tym treść wiadomości, jeżeli jest zapisywana | [UZUPEŁNIJ: maksymalny okres i zasady rotacji]. |
| Kontekst AI w pamięci Bota | [UZUPEŁNIJ: liczba tur, czas bezczynności, zakres historii]; pamięć procesu jest czyszczona po restarcie. Nie oznacza to usunięcia danych u dostawcy ani wiadomości Discord. |
| Dane AI u dostawcy, zapisane odpowiedzi i pliki narzędzi | [UZUPEŁNIJ: okresy wynikające z konfiguracji i umowy, sposób usuwania]. |
| Zestawienia kosztów i identyfikatory użytkowników | [UZUPEŁNIJ: okres; dzienny limit nie oznacza codziennego usuwania historii]. |
| Zdjęcia i metadane w galerii oraz pliki Drive | [UZUPEŁNIJ: czas i kryteria przeglądu zasadności publikacji lub przechowywania]. |
| Materiały na kanale YouTube | [UZUPEŁNIJ: okres publikacji i przeglądu]; usunięcie wpisu galerii nie usuwa automatycznie filmu. |
| Dane pobrane przez YouTube API | Weryfikowane, odświeżane lub usuwane w terminach wymaganych przez YouTube; standardowo nie później niż po 30 dniach, z uwzględnieniem właściwych wyjątków. [POTWIERDŹ: wdrożenie procesu]. |
| Lokalne rejestry publikacji i zapobiegania duplikatom | [UZUPEŁNIJ: okres dla danych własnych; dla danych API stosuj także krótsze wymagania dostawcy]. |
| Identyfikatory obsłużonych e-maili | Lista do 100 ostatnio obsłużonych identyfikatorów; dodatkowo [UZUPEŁNIJ: maksymalny czas, również przy braku nowych e-maili]. |
| Powiadomienia Gmail na Discordzie | [UZUPEŁNIJ: okres i sposób usuwania]. |
| Tokeny OAuth | Do zakończenia potrzeby integracji, cofnięcia upoważnienia lub utraty ważności, z usunięciem zgodnie z procedurą odłączenia. |
| Zgłoszenia, dowody zgód i dokumentacja roszczeń | [UZUPEŁNIJ: odrębne okresy lub kryteria odpowiadające podstawie prawnej]. |
| Kopie zapasowe | [UZUPEŁNIJ: cykl nadpisania oraz procedura ponownego zastosowania usunięć po odtworzeniu]. |

Pliki tymczasowe filmów są usuwane po zakończeniu obsługi uploadu; dla plików pozostawionych po awarii stosujemy [UZUPEŁNIJ: procedura i maksymalny okres]. Wiadomości i kopie pozostające w usługach zewnętrznych wymagają odrębnej obsługi zgodnie z prawami osoby i ustawieniami danej usługi.

## 8. Google i YouTube — odłączenie oraz usuwanie

Aplikacja korzysta z YouTube API Services. Zasady Google są dostępne w [Polityce prywatności Google](https://policies.google.com/privacy?hl=pl).

Osoba, która autoryzowała konto Google, może cofnąć uprawnienia w [ustawieniach połączonych aplikacji Google](https://security.google.com/settings/security/permissions). Odłączenie zatrzymuje możliwość dalszego korzystania z upoważnienia. Nie usuwa samoistnie filmów ani innych plików z konta Google.

Usunięcie danych przechowywanych przez Aplikację można zgłosić na [UZUPEŁNIJ: e-mail lub URL formularza], wskazując konto lub materiał. Dane przechowywane z YouTube API objęte żądaniem usuwamy możliwie szybko, najpóźniej w ciągu 7 dni. Dla cofnięcia autoryzacji w ustawieniach Google stosujemy również wymagany termin usunięcia powiązanych danych API, nieprzekraczający 30 dni. [POTWIERDŹ przed publikacją: wykrywanie cofnięcia dostępu i obsługę terminów].

Żądanie usunięcia samego filmu z kanału organizatora lub pliku Drive należy wskazać osobno. Administrator obsługuje takie zgłoszenie w odniesieniu do zasobów, którymi zarządza. Usunięcie wiadomości lub reakcji na Discordzie nie jest automatycznym usunięciem kopii w galerii, Drive ani YouTube.

## 9. Prawa osób

W granicach przewidzianych przez RODO przysługuje Ci prawo dostępu do danych i otrzymania ich kopii, sprostowania, usunięcia, ograniczenia przetwarzania oraz przenoszenia danych, gdy przetwarzanie jest zautomatyzowane i oparte na zgodzie lub umowie.

Możesz wnieść sprzeciw wobec przetwarzania opartego na uzasadnionym interesie z przyczyn związanych z Twoją szczególną sytuacją. Jeżeli podstawą jest zgoda, możesz ją wycofać w dowolnym momencie, równie łatwo jak jej udzielić, kontaktując się przez [UZUPEŁNIJ: kanał]. Wycofanie nie wpływa na zgodność z prawem wcześniejszego przetwarzania.

Możesz złożyć skargę do Prezesa Urzędu Ochrony Danych Osobowych; informacje o sposobach kontaktu znajdują się na [uodo.gov.pl](https://uodo.gov.pl).

Na żądanie odpowiadamy bez zbędnej zwłoki, zasadniczo w ciągu miesiąca. Jeżeli dopuszczalne jest przedłużenie terminu, informujemy o tym i przyczynach w ciągu pierwszego miesiąca. Krótsze terminy dotyczące danych YouTube API pozostają w mocy.

Możemy poprosić o informacje niezbędne do potwierdzenia tożsamości lub odnalezienia danych, nie żądając nadmiarowych dokumentów. Jeżeli nie możemy uwzględnić żądania w całości, wyjaśniamy przyczyny i dostępne środki ochrony.

## 10. Automatyzacja i bezpieczeństwo

Bot automatycznie odpowiada na komendy, sprawdza role, stosuje limity i przetwarza materiały. Odpowiedzi AI są generowane automatycznie. Nie podejmujemy wyłącznie automatycznie decyzji wywołujących skutki prawne lub podobnie istotnie wpływających na osoby. [POTWIERDŹ: zgodność tego stwierdzenia z praktyką].

Dostęp do infrastruktury i danych ograniczamy do osób potrzebujących go do wykonywania obowiązków. Stosowane środki obejmują [UZUPEŁNIJ: faktycznie wdrożone środki ochrony, np. kontrolę dostępu, ochronę tokenów, szyfrowanie transmisji, aktualizacje i bezpieczne kopie zapasowe]. Incydenty można zgłaszać pod adresem kontaktowym Administratora.

## 11. Strona internetowa, cookies i usługi zewnętrzne

Sam Bot nie instaluje cookies w przeglądarce użytkownika poprzez wiadomości Discorda. Korzystanie z Discorda, Google i strony galerii może wiązać się z cookies i innymi technologiami tych usług.

Zasady strony galerii, w tym logi odwiedzin, odtwarzacze YouTube, analityka oraz sposób uzyskiwania wymaganych zgód, opisuje [UZUPEŁNIJ: URL właściwej polityki strony; jeżeli ma to być ten dokument, dodaj pełny opis faktycznej konfiguracji strony].

## 12. Zmiany

Aktualną wersję publikujemy pod adresem [UZUPEŁNIJ: URL]. O istotnych zmianach informujemy przez [UZUPEŁNIJ: kanał powiadomień]. Zmiana dokumentu nie rozszerza automatycznie wcześniej udzielonych zgód. Przed rozpoczęciem nowych operacji wymagających odrębnej zgody lub informacji realizujemy te obowiązki.
