# Weryfikacja wersji 2.8 — 22.10.2026

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

Paczka nie zawiera trasy syntetycznej, testowego serwera ani zapisanych wycieczek. Asystent nie opublikował wersji 2.8 na GitHubie ani GitHub Pages.
