# Weryfikacja wersji 2.7 — 21.10.2026

- Pełny zestaw `node tests/planner.test.cjs` obejmuje trasowanie, odmowy HTTP 403/429, wiele punktów oraz nowe funkcje planowania.
- Prawdziwy BRouter zwrócił HTTP 200 dla trasy z kompletem nowych preferencji; testowana trasa w Piotrkowie miała około 4,5 km. Format przełączników API sprawdzony na serwerze (wartości liczbowe 1/0).
- W przeglądarce: zapis wycieczki z postojem 20 min, ponowne uruchomienie z pustą mapą i ręczne wczytanie zachowały postój i preferencje. Sama jazda 17 min, z postojem 37 min; godziny przyjazdu uwzględniają wcześniejsze postoje.
- W przeglądarce, na jawnie testowych odpowiedziach: trzy kategorie miejsc pojawiają się na mapie i liście. Dodanie sklepu wstawia punkt do kolejności, zachowuje poprzedni postój 20 min, dodaje nowy postój 10 min i uruchamia przeliczenie.
- Testy obejmują przesuwanie, odwracanie i usuwanie punktów, zgodność starszych zapisów, projekcję na ślad z 10 000 wierzchołków oraz bezpieczne wyświetlanie nazw z zewnętrznych danych.
- **Nie udało się potwierdzić wyszukiwania miejsc na żywo.** Publiczne usługi Overpass podczas testów odmawiały odpowiedzi lub przekraczały limit czasu. Logika interfejsu i przetwarzania danych została sprawdzona oddzielnie na odpowiedziach testowych. Nie jest to potwierdzenie bieżącej dostępności publicznego serwera. Wersja nie zawiera przykładowych miejsc ani testowego serwera.
- Nowa wersja jest przygotowana lokalnie. Nie została opublikowana w repozytorium ani na GitHub Pages przez asystenta.
