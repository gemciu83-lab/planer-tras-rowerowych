# Weryfikacja wersji 2.9 — 22.10.2026

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

Paczka nie zawiera trasy syntetycznej, testowego serwera, atrap GPS ani zapisanych wycieczek. Asystent nie opublikował wersji 2.9 na GitHubie ani GitHub Pages.
