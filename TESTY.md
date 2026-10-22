# Weryfikacja wersji 3.2 — 22.10.2026

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
