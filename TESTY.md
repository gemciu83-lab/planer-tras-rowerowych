# Weryfikacja wersji 3.9 — 26.10.2026

Pełny zestaw testów obejmuje dodatkowo parser GPX, punkty kontrolne i ich zapis, lokalne łączenie odcinków, zachowanie nieedytowanych współrzędnych, pętle, brak sztucznych łączników, transakcyjne zatwierdzanie zmian oraz uzupełnianie wysokości. Testy sprawdzają także błąd i nieaktualną odpowiedź podczas edycji lub pobierania wysokości.

Przeglądarka, lokalny podgląd i syntetyczne GPX:

- GPX z prefiksem przestrzeni nazw `g:` i 241 wysokościami tworzy 21 punktów kontrolnych na pętli 81,2 km. Profil jest od razu widoczny i zawiera wykres. Oryginalna geometria nie jest upraszczana.
- Wywołano zdarzenie dragend rzeczywistego markera Leaflet. Zapytanie obejmuje trzy sąsiednie punkty, a nie całą pętlę. Porównanie współrzędnych potwierdza identyczny prefiks i sufiks śladu. Cofnięcie przywraca 241 oryginalnych wierzchołków i prawidłowe powiązania punktów; ponowienie przywraca zmianę.
- Kontrolowany błąd trasowania pozostawia poprzednią geometrię i punkty w całości, wraz z kilometrażem i profilem.
- Obsługa przeciągania linii została uruchomiona przez zdarzenia mousedown/mousemove/mouseup testowego podglądu. Dodaje punkt i zmienia fragment. Przesunięcie startu pętli zachowuje zamkniętą geometrię oraz prawidłowe indeksy punktów. Te próby zdarzeń są testem integracji, nie ręczną próbą fizycznej myszy użytkownika.
- GPX 2D początkowo nie ma profilu. Po kliknięciu Pobierz wysokości kontrolowany wynik wypełnia 241 wartości i pokazuje wykres. Kontrolowane HTTP 503 nie zmienia ani geometrii, ani brakujących wartości.
- Dodatkowo rzeczywista usługa Open-Meteo poprawnie uzupełniła wysokości dla krótkiego śladu na publicznych, syntetycznych współrzędnych. Profil pojawił się w przeglądarce. To test dostępności API, nie ocena dokładności modelu terenu.
- Ręczny zapis, odświeżenie strony z pustą mapą i ponowne wczytanie zachowują 241 wierzchołków, 21 punktów kontrolnych, komplet wysokości i informację o DEM. Brak poziomego przewijania i błędów aplikacji w konsoli w sprawdzonym widoku.

Rzeczywistego pliku użytkownika nie otrzymano — dostępny był zrzut ekranu. Testy używają wygenerowanych GPX. Nowe lokalne odcinki w podglądzie korzystały z kontrolowanych odpowiedzi trasowania; nowego przebiegu BRoutera nie sprawdzano na żywo. Dotychczasowe testy kolejki, 403/429 i tras z ponad 1000 punktów nadal obowiązują. Serwer, dodatkowe przyciski i dane podglądu są poza ZIP. Asystent nie opublikował wersji 3.9 na GitHub Pages.

## Weryfikacja wcześniejszej wersji 3.8 — 23.10.2026

Pełny zestaw testów obejmuje dodatkowo synchronizację postojów pomiędzy mapą i oknem ustawień, odrzucanie wartości poza zakresem, brak powtarzanego wpisu historii dla tych samych wartości, zachowanie czasu zaakceptowanej przerwy oraz brak żądań trasowania.

Sprawdzenie w przeglądarce na syntetycznej trasie 50 km:

- Wpisanie w kafelku mapy 10 km oraz 15 min natychmiast tworzy propozycje na 10, 20, 30 i 40 km. Okno szczegółów pokazuje te same wartości.
- Kliknięta propozycja 10 km ma w formularzu czas 15 min. Po zatwierdzeniu znacznik pokazuje Postój 15 min · 10 km.
- Zmiana czasu nowych przerw na 20 min nie nadpisuje zaakceptowanego postoju 15 min. Okno listy poprawnie pokazuje obie informacje.
- Zmiana w oknie na 20 km i 12 min aktualizuje pola mapy. Pozostają propozycje 20 i 40 km oraz zaplanowany postój 15 min na 10 km.
- Schowanie i przywrócenie paska zachowuje 20 km i 12 min. Kafelek ma 40 px wysokości i jest w jednej linii z pozostałymi narzędziami, bez poziomego przewijania. Licznik trasowania przez całą próbę wynosi 0. Brak błędów JavaScript.

Ustawień startowych z 3.7 nie zmieniano w tej poprawce. Nie sprawdzano ponownie fizycznego GPS, pogody ani zewnętrznej usługi trasowania. Podgląd i syntetyczne dane są poza paczką. Wersja nie została opublikowana przez asystenta na GitHub Pages.

## Weryfikacja wcześniejszej wersji 3.7 — 23.10.2026

Pełny zestaw `node tests/planner.test.cjs` przechodzi. Nowy test uruchomienia sprawdza przeniesienie wyłącznie masy rowerzysty ze starego magazynu, pierwszeństwo nowej zapisanej masy, ignorowanie pozostałych starych parametrów, wartości domyślne, pustą trasę i historię, zachowanie zapisanych wycieczek, ponowne uruchomienie, nieprawidłowe wartości i zablokowany localStorage.

W przeglądarce:

- Zmieniono masę rowerzysty na 68,5 kg, bagaż na 9 kg, masę roweru na 12 kg, tempo na 29 km/h, profil na Ręcznie i rower na Gravel. W postojach wpisano 50 km oraz 30 min.
- Po przeładowaniu masa rowerzysty wynosi 68,5 kg. Bagaż wraca do 2 kg, rower do 22 kg, tempo do 16 km/h, profil i rodzaj roweru do trekking, a postoje do 25 km i 10 min. Opisy własnych list wyboru pokazują zgodne wartości.
- Na starcie brak punktów i trasy, licznik żądań trasowania 0, brak błędów JavaScript. GPS w podglądzie jest zastąpiony odmową dostępu, dlatego nie dodaje S.

Zapisane wycieczki nadal przechowują indywidualne parametry i są wczytywane ręcznie. Nie testowano ponownie fizycznego GPS ani zewnętrznych usług. Podgląd testowy nie wchodzi do ZIP. Wersja 3.7 nie została opublikowana przez asystenta na GitHub Pages.

## Weryfikacja wcześniejszej wersji 3.6 — 23.10.2026

Pełny zestaw `node tests/planner.test.cjs` oraz sprawdzenie składni wszystkich plików JavaScript przechodzą. Nowy moduł planner-selects.js zmienia widoczny interfejs dwóch dolnych list; zachowuje dotychczasowe wartości i zdarzenia change oryginalnych pól.

W przeglądarce przy szerokości mapy 1265 px:

- Wszystkie sześć kafelków parametrów oraz Postoje, Pełny ekran i PNG mają wspólną współrzędną y i wysokość 40 px. Brak poziomego przewijania strony.
- Obie listy otwierają się powyżej kafelka. Tło menu to rgb(32, 53, 54), a opcje mają jasny tekst. Podpisy mają osobne 11 px wysokości i pozostają nad treścią pola. Zaznaczenie nie rysuje obrysu wokół samego tekstu.
- Wybór Ręcznie zmienia oryginalne pole profilu. Wczytanie syntetycznej trasy trekkingowej przywraca odpowiedni podpis na kafelku.
- Klawiatura: strzałka i Enter wybierają Gravel oraz synchronizują rodzaj roweru w ustawieniach. End i Escape zamykają listę bez zmiany profilu. Tab zamyka listę profilu i przenosi fokus do tempa. Kliknięcie w bagaż zamyka listę rodzaju roweru.
- X i ponowne otwarcie zachowują bagaż 10 kg i Gravel; fokus trafia do widocznego przycisku wyboru profilu. Podczas tych zmian licznik zapytań trasowania wynosi 0. Nie stwierdzono błędów JavaScript.

Weryfikacja używała lokalnego podglądu i syntetycznej trasy 50 km; nie testowano ponownie zewnętrznych usług, fizycznego GPS ani pobierania PNG. Pliki podglądu są poza paczką. Asystent nie opublikował wersji 3.6 na GitHub Pages.

## Weryfikacja wcześniejszej wersji 3.5 — 23.10.2026

Pełny zestaw `node tests/planner.test.cjs` przechodzi. Usunięto nakładające się starsze style dolnego paska. Parametry i przyciski mapy są teraz dziećmi jednego rzędu, dzięki czemu przeglądarka wyrównuje je razem.

Sprawdzenie w przeglądarce na syntetycznej trasie 50 km, mapa o szerokości 1265 px:

- Pierwszy kafelek zaczyna się na x=12 px, a prawy brzeg PNG jest na x=1253 px. Rząd zajmuje dostępną szerokość z równymi marginesami po 12 px.
- Profil, tempo, rowerzysta, rower, bagaż, rodzaj roweru, Postoje, Pełny ekran i PNG mają tę samą współrzędną y i wysokość dokładnie 32 px. Każdy kafelek ma własną ramkę i tło. Wewnętrzne pola mają przezroczyste tło i brak ramki.
- X ma 18 × 18 px i jest wyśrodkowany pionowo z boku parametrów. Chowa cały zestaw, łącznie z Postojami, pozostawiając Pełny ekran, PNG i statystyki po prawej.
- Przywrócenie przez Parametry zachowuje bagaż 10 kg i rodzaj Gravel, a fokus trafia do widocznego pola profilu. Licznik trasowania podczas edycji i chowania wynosi 0.
- Postoje otwiera istniejące okno ustawień przerw. Brak poziomego przewijania i błędów JavaScript podczas próby.

Wąskiego ekranu fizycznego nie testowano osobno; układ ma reguły zawijania poniżej 950 px. Zmiana nie dotyczy modelu energii ani usług trasowania. Nie sprawdzano ponownie rzeczywistego GPS, pogody ani pobierania PNG. Serwer podglądu i syntetyczne dane nie wchodzą do ZIP. Asystent nie opublikował wersji 3.5 na GitHub Pages.

## Weryfikacja wcześniejszej wersji 3.4 — 23.10.2026

Pełny zestaw `node tests/planner.test.cjs` przechodzi. Zmiana dotyczy układu parametrów i położenia istniejącego przycisku postojów.

W przeglądarce na syntetycznej trasie 50 km, przy szerokości mapy 1265 px:

- Sześć kafelków pól, Postoje, Pełny ekran mapy i Zapisz PNG mają dokładnie 32 px wysokości i wspólną współrzędną pionową. Grupy nie nachodzą na siebie. Nie ma poziomego przewijania strony.
- Postoje otwiera dotychczasowe okno z odstępem 25 km i czasem 10 minut.
- Bagaż 10 kg i wybór Gravel pozostają po schowaniu i przywróceniu paska. Licznik zapytań trasowania wynosi 0.
- X chowa także Postoje. Zakładka Parametry przywraca komplet. Statystyki po prawej i przyciski pełnego ekranu oraz PNG pozostają widoczne.

Węższe widoki mają układ zawijany; nie wykonywano osobnej próby urządzenia mobilnego. Rzeczywiste GPS, serwer trasowania, pobieranie PNG i pogoda nie były ponownie sprawdzane w tej zmianie wyglądu. Podgląd testowy i syntetyczna trasa nie należą do paczki. Wersja nie została opublikowana przez asystenta na GitHub Pages.

## Weryfikacja wcześniejszej wersji 3.3 — 22.10.2026

Pełny zestaw `node tests/planner.test.cjs` przechodzi. Dodano synchronizację dolnego wyboru rodzaju roweru z istniejącym modelem energii, a test renderera PNG potwierdza rysowanie litery P dla obu rodzajów przerw.

W przeglądarce na syntetycznej trasie 50 km:

- Sześć osobnych kafelków ma tę samą współrzędną pionową i wysokość 54 px: profil, tempo, rowerzysta, rower, bagaż i rodzaj roweru.
- Bagaż 10 kg i rodzaj Gravel synchronizują się z ustawieniami; profil wyznaczania pozostaje trekking. Licznik żądań trasowania wynosi 0.
- Zarówno żółta propozycja, jak i zaakceptowany zielony postój mają na mapie literę P. Po akceptacji podpis pokazuje „Postój 10 min · 25 km”. Samo dodanie przerwy nie wysyła zapytania trasowania.
- × chowa dolne kafelki do „⚙ Parametry”. Kafelki statystyk pozostają widoczne po prawej. Przywrócenie zachowuje bagaż 10 kg i wybór Gravel.
- Brak poziomego przewijania oraz błędów JavaScript w sprawdzonym widoku komputerowym.

Test pobierania PNG w przeglądarce nie był ponawiany; sam renderer oznaczenia P jest objęty testem automatycznym. Usług trasowania, rzeczywistej pogody i fizycznego GPS nie sprawdzano ponownie w tej zmianie układu. Testowy serwer, kontrolowana lokalizacja i syntetyczna trasa są poza paczką. Asystent nie opublikował wersji 3.3 na GitHubie ani GitHub Pages.

## Weryfikacja wcześniejszej wersji 3.2

Pełny zestaw `node tests/planner.test.cjs` przechodzi. Zmieniono układ, nie model energii ani sposób wysyłania tras. Test panelu potwierdza, że ukrywanie dotyczy parametrów, a osobna sekcja statystyk pozostaje widoczna.

W przeglądarce na syntetycznej trasie 50 km:

- Wszystkie pięć pól ma tę samą współrzędną pionową: profil trasy, tempo, rowerzysta, rower, bagaż. Pasek w sprawdzonym widoku ma 67 px wysokości.
- Bagaż 10 kg jest widoczny obok masy roweru, synchronizuje się z ustawieniami i zmienia wynik do około 960 aktywnych kcal. Licznik trasowania pozostaje 0.
- × chowa pasek i zostawia małą zakładkę „⚙ Parametry”. Statystyki po prawej pozostają widoczne, liczba punktów wynosi nadal 2. Przywrócenie zachowuje bagaż 10 kg.
- Brak poziomego przewijania strony i błędów JavaScript podczas próby.

Repozytorium GitHub main odczytane w trakcie zadania zawierało index.html z numerem 3.1.0 i polem mapLuggageWeight. Zrzut użytkownika pokazywał wcześniejszy układ. Nie potwierdzono, czy powodem była stara otwarta karta, pamięć przeglądarki czy stan wdrożenia Pages. Bieżącej strony Pages nie udało się odczytać narzędziem web. Wersja 3.2 została przygotowana lokalnie i nie została opublikowana przez asystenta.

## Sprawdzenia wcześniejszej wersji 3.1

Pełny zestaw `node tests/planner.test.cjs` przechodzi, łącznie z dotychczasowymi testami trasowania, GPS, energii, postojów i nowymi testami dolnego panelu. Testy panelu obejmują zachowanie parametrów i trasy przy ukrywaniu, pojedyncze przekazanie zmiany profilu do dotychczasowej kontrolki, lokalne przeliczenie kalorii po zmianie roweru/pozycji, synchronizację pól, skrót P z pomijaniem wpisywania tekstu oraz miejsce rezerwowane w dopasowaniu mapy i centrowaniu GPS.

Przeglądarka, lokalny serwer testowy i syntetyczna trasa 50 km:

- Dystans, czas, aktywne i całkowite kalorie oraz wszystkie podstawowe pola przeniesione do dolnego panelu. U góry mapy pozostają styl mapy i GPS.
- Zmiana bagażu na 12 kg, rodzaju roweru na gravel i pozycji na turystyczną synchronizuje ustawienia. Licznik zapytań do routingu pozostaje 0, liczba punktów 2 i dystans 50,0 km.
- × chowa jednocześnie wyniki i pola. P przywraca całość; pole bagażu nadal pokazuje 12 kg, a wynik kalorii jest aktualny.
- Po schowaniu i odświeżeniu panel pozostaje schowany, widoczna jest zakładka przywracania. Trasa po odświeżeniu jest pusta, zgodnie z wcześniejszym wymaganiem.
- Wybór profilu „Ręcznie” z dolnej listy uruchamia automatyczne przeliczenie i daje 50,0 km bez naciskania przycisku wyznaczania. Obie kontrolki profilu pozostają zgodne. Dopasowywania MTB/szosy na rzeczywistym BRouterze w tej zmianie nie testowano ponownie; używany jest istniejący mechanizm i jego testy.
- Po dopasowaniu załadowanej trasy oba znaczniki S i 1 znajdują się nad panelem. Przyciski mapy są w osobnym rzędzie ponad panelem. Nie stwierdzono poziomego przewijania strony ani błędów JavaScript podczas tych prób.

Zewnętrzne usługi i fizyczny GPS nie były ponownie weryfikowane w tej zmianie układu. Wcześniejsze sprawdzenia 3.0 opisano niżej. Testowy serwer, przyciski i syntetyczna trasa nie wchodzą do paczki. Asystent nie opublikował wersji 3.1 na GitHubie ani GitHub Pages.

## Weryfikacja wcześniejszej wersji 3.0

Nowy moduł energii i interfejs zachowują trasowanie 2.9. Testy fizycznego modelu obejmują masę roweru i bagażu, masę rowerzysty, pozycję jazdy, podjazdy/zjazdy, wiatr czołowy/boczny/tylny, odwrócenie kierunku przejazdu oraz brak ujemnych kalorii. Wydatek spoczynkowy zależy tylko od rowerzysty i czasu; postoje nie zmieniają kalorii aktywnych i dodają spoczynkowe dokładnie raz. Testy prognozy sprawdzają UTC, zakres godzin, wpływ wcześniejszych postojów, brakujące dane/null, jednostki m/s, zmianę trasy i wygaśnięcie pamięci prognozy. Starsze zapisy otrzymują 0 kg bagażu, domyślną pozycję i ręczny wiatr 0 km/h; nowe pola przechodzą walidację i wczytanie zapisanej wyprawy.

W przeglądarce, na syntetycznej płaskiej trasie 50 km:

- Rowerzysta 70 kg, rower 15 kg, 20 km/h: około 920 aktywnych i 1100 całkowitych kcal. Są to zaokrąglone wyniki modelu, nie pomiar fizjologiczny.
- Bagaż 10 kg dodany z kafelka mapy synchronizuje się z polem w ustawieniach i podnosi wynik do około 960 aktywnych i 1140 całkowitych kcal.
- Ręczny wiatr 20 km/h z północy daje na trasie na północ większy wynik; zmiana na wiatr z południa obniża go. Pozycja turystyczna również zmienia wynik.
- Dodatkowy postój 30 min dolicza 35 kcal spoczynkowych dla osoby 70 kg; aktywne nie rosną od samego postoju.
- Zapis, odświeżenie z pustą trasą i ręczne wczytanie zachowują osobno rower 15 kg, bagaż 10 kg, pozycję, wiatr i postoje.
- Błąd HTTP 503 w kontrolowanej prognozie daje w trybie prognozy brak kalorii i czytelny komunikat; poprawna odpowiedź przywraca obliczenia.
- Rzeczywiste Open-Meteo w przeglądarce poprawnie zwróciło prognozę dla publicznych miejsc na trasie testowej. Przykładowy wynik: około 1510 aktywnych / 1690 całkowitych kcal, 48% dystansu pod wiatr i 52% przy wietrze bocznym. To jednorazowe sprawdzenie dostępności usługi, nie potwierdzenie faktycznego pogody ani spalania użytkownika.
- Zmiany mas, pozycji, przerw i wiatru oraz pobranie prognozy: **0 zapytań do serwera trasowania**. Brak błędów JavaScript w konsoli podczas tych prób.
- Układ ustawień ma trzy kolumny na sprawdzonym widoku komputerowym, bez poziomego przewijania i bez wewnętrznych suwaków nowych paneli. Rozwinięte parametry mapy mieszczą się na mapie; przyciski dolne nie nachodzą na pole bagażu. W trybie prognozy ręczne pola wiatru są schowane, a opis podaje zakres prognozowanych prędkości dla przejazdu.

Nie zmierzono wydatku energetycznego rzeczywistego rowerzysty. To model planowania, z ograniczeniami opisanymi w README. Testy interfejsu wykorzystywały kontrolowaną lokalizację i syntetyczną trasę. Testowe serwery, przyciski i atrapy pogody/GPS są poza paczką. Wersja 3.0 nie została opublikowana na GitHubie ani GitHub Pages przez asystenta.

## Weryfikacja wcześniejszej wersji 2.9

Pełny zestaw `node tests/planner.test.cjs` przechodzi. Nowe testy GPS obejmują natychmiastowe ustawienie S, kliknięcie punktu 1 podczas doprecyzowania, świeży pomiar po niedawnym pomiarze z pamięci, ignorowanie późniejszego starego pomiaru, ochronę przeciągniętego S i istniejącej wycieczki, błędne współrzędne, brak zgody, przekroczenie czasu, anulowanie oraz wariant bez watchPosition. Testy trasowania potwierdzają zwłokę 600 ms, pobieranie tylko dwupunktowego końca przy rozbudowie 2→3→4 punktów, zerową liczbę zapytań przy dokładnym powtórzeniu, pełne zapytanie zamiast dwóch brakujących odcinków i połączenie z faktycznym końcem poprzedniej geometrii drogowej. Testy kolejki i HTTP 403/429 nadal przechodzą.

W przeglądarce sprawdzono stronę 2.9 z kontrolowaną, syntetyczną lokalizacją: niedawny pomiar ustawił S, kliknięcie mapy dodało punkt 1, automat pobrał trasę, a późniejszy pomiar ±5 m zmienił znacznik lokalizacji bez przesunięcia S i bez kolejnego zapytania trasowania. Test nie jest pomiarem czasu fizycznego GPS użytkownika ani szybkości zewnętrznego serwera. Kod aplikacji używa natywnej geolokalizacji; atrapa występuje tylko w lokalnym serwerze testowym poza paczką.

Nie potwierdzono czasu rzeczywistego pierwszego odczytu na urządzeniu użytkownika. Zależy on od zgody, sprzętu i dostępnego pomiaru przeglądarki. Nie obiecujemy procentowego przyspieszenia zewnętrznych obliczeń. Potwierdzone skrócenie własnej zwłoki planera: 1500→600 ms.

W kolejnym teście przeglądarki wyłączono atrapę trasowania i użyto rzeczywistego BRoutera dla publicznych, testowych współrzędnych w Piotrkowie Trybunalskim. Pierwsze wyznaczenie S→1 dało 0,9 km, a dopisanie punktu 2 zwiększyło dystans do 1,9 km. Wysłano łącznie dwa zapytania, każde z dwoma współrzędnymi; druga odpowiedź połączyła się z zapisanym początkiem trasy. Komunikaty aplikacji pokazały odpowiednio 0,3 s i 0,1 s dla tych krótkich obliczeń. To pojedyncze pomiary, nie gwarancja szybkości długich tras. Konsola nie zgłosiła błędów JavaScript podczas pierwszego rzeczywistego wyznaczenia. Lokalizacja w tym teście nadal była kontrolowana, a nie fizycznym GPS użytkownika.

## Sprawdzenia wcześniejszej wersji 2.8 (22.10.2026)

Pełny zestaw `node tests/planner.test.cjs` przechodzi, łącznie z testami trasowania i nowymi testami przerw.

Sprawdzone w przeglądarce na syntetycznej trasie GPX długości 108 km:

- Propozycje odpoczynku na 25, 50, 75 i 100 km.
- Kliknięcie propozycji i zaplanowanie przerwy 10 min: czas zmienia się z 6 h 45 min na 6 h 55 min.
- Postój 15 min przypisany do punktu: całość 7 h 10 min. Cofnięcie wraca do 6 h 55 min, ponowienie do 7 h 10 min.
- Zapis, ponowne uruchomienie z pustą mapą i ręczne wczytanie zachowują oba postoje oraz ustawienia przerw.
- Zmiana odstępu na 20 km i domyślnego czasu na 15 min, chowanie/pokazywanie propozycji i kliknięcie podpisu na mapie.
- Rozmieszczenie pobliskich podpisów poprawione, aby kliknięcie propozycji 20 km nie otwierało sąsiedniego postoju 25 km.
- Lokalny serwer testowy zliczał żądania trasowania: 0, mimo edycji przerw i ponownego wczytania wycieczki.
- Konsola przeglądarki nie zgłosiła błędów JavaScript podczas tych testów.

Testy obliczeń obejmują też granice przed metą, unikanie propozycji obok zaplanowanych postojów, pozycjonowanie na segmentach śladu, starsze zapisy, wyłączanie postojów poza skróconą trasą oraz czyszczenie planu.

Renderer PNG ma dodane znaczniki przerw; test rysowania sprawdza podpisy planowanych i proponowanych przerw. Test pobrania PNG w przeglądarce nie został zakończony: połączenie automatyzacji z przeglądarką przekroczyło czas i zostało przerwane. Nie traktujemy eksportu jako w pełni sprawdzonego ręcznie.

Wyszukiwanie sklepów/wody/odpoczynku przez Overpass nie było zmieniane ani ponownie potwierdzane na żywo. Zachowuje ograniczenia dostępności zewnętrznego serwera opisane w README.

Paczka nie zawiera trasy syntetycznej, testowego serwera, atrap GPS ani zapisanych wycieczek.
