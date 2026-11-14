# Udostępnianie pozycji w Planerze 3.24

## Szybka próba na komputerze

1. Rozpakuj ZIP i otwórz terminal w rozpakowanym katalogu.
2. Uruchom `node live-service/local.mjs` (Node.js 22 lub nowszy). Terminal wyświetli adres `http://127.0.0.1:8922` oraz jednorazowy klucz lokalny.
3. Otwórz adres, wybierz **Udostępnij pozycję**, wklej klucz i kliknij **Utwórz link i włącz GPS**. Zezwól przeglądarce na lokalizację.
4. Otwórz skopiowany link w drugiej karcie. Po pierwszym odczycie kliknij **Pokaż pozycję na mapie**. W pierwszej karcie kliknij **Zakończ udostępnianie**. Podgląd zamknie się przy kolejnym odświeżeniu, zwykle w ciągu 10 sekund.

Adres 127.0.0.1 służy do próby na jednym komputerze. Do testu między telefonem a komputerem uruchom usługę publiczną przez HTTPS.

## Próba między telefonem a komputerem

1. W katalogu `live-service` zaloguj się do własnego konta Cloudflare poleceniem `npx wrangler login`. W `wrangler.toml` jest już adres GitHub Pages `https://gemciu83-lab.github.io`. Przy innej domenie zmień `PLANNER_ORIGIN` na adres domeny bez ścieżki.
2. Uruchom `npx wrangler deploy`. Zapisz adres HTTPS Workera wyświetlony w terminalu.
3. Wygeneruj klucz poleceniem `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Uruchom `npx wrangler secret put LIVE_SETUP_KEY` i wklej wygenerowany klucz w terminalu. Zachowaj go do uruchamiania sesji. Trzymaj go poza repozytorium i poza linkiem do podglądu.
4. W `assets/planner-live-config.js` wpisz adres HTTPS Workera w cudzysłowie po `liveServiceOrigin =`, bez końcowego ukośnika. Z głównego katalogu planera uruchom `node tools/build-manifest.cjs`, żeby zaktualizować `version.json` po zmianie adresu.
5. Wgraj na GitHub Pages `index.html`, `pozycja.html`, `version.json` i katalog `assets`. Otwórz opublikowany planer na telefonie. W **Menu → Udostępnij pozycję** wpisz klucz, wybierz 1, 4 lub 8 godzin i utwórz link. Wyślij link zaufanej osobie do testu.

Każdy, kto otrzyma pełny link, może otworzyć podgląd do końca sesji. Serwer przyjmuje tylko ostatni zaszyfrowany odczyt, a klucz szyfrowania jest w części linku po znaku `#`. Po otwarciu mapy OpenStreetMap otrzymuje żądania kafelków okolicy widocznej na ekranie.

Gdy ekran się zablokuje, karta trafi w tło lub zabraknie internetu, odczyty mogą przestać się aktualizować. Odbiorca widzi wiek ostatniej pozycji. Po odświeżeniu planera użyj **Wznów wysyłanie GPS**. Przy braku sieci przycisk **Zakończ udostępnianie** zatrzymuje odczyt na telefonie. Zamknięcie linku wymaga ponowienia po odzyskaniu sieci albo nastąpi w chwili wygaśnięcia.

**Sprawdź udostępnianie** sprawdza usługę i lokalizację telefonu. Możesz też wpisać klucz przed sprawdzeniem, aby potwierdzić jego poprawność. Po utworzeniu linku przycisk sprawdza również odczyt ostatniej wysłanej pozycji tak, jak zrobi to odbiorca. Próbny odczyt GPS służy do diagnostyki na urządzeniu.

Jeśli masz już usługę z wersji 3.22, wdrożenie poleceniem `npx wrangler deploy` w tym samym projekcie doda diagnostykę. Użyj dotychczasowego publicznego adresu usługi i zachowanego klucza.
