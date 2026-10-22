# Planer tras rowerowych 2.8

Nowa wersja strony: widoczne postoje i propozycje odpoczynku na linii trasy. Pozostają preferencje dróg, wyszukiwanie miejsc i postoje przy punktach z wersji 2.7.

## Nowość: przerwy na mapie

- Po wyznaczeniu lub wczytaniu trasy pojawiają się żółte znaczniki **„Odpoczynek?”**, domyślnie co 25 km. To propozycje pozycji na śladzie, a nie potwierdzone sklepy, ławki czy miejsca odpoczynku w terenie.
- Kliknij ikonę lub jej podpis, ustaw czas i wybierz **„Zaplanuj ten postój”**. Znacznik zmieni się na zielony **„Postój 10 min”**. Dopiero zaakceptowany postój wpływa na czas wyprawy i kolejne godziny przyjazdu.
- W prawym dolnym rogu mapy, obok pełnego ekranu i zapisu PNG, jest przycisk **„Ⅱ Postoje”**. Zmienisz tam odstęp (domyślnie 25 km), domyślny czas przerwy (10 min), schowasz propozycje i usuniesz zaplanowane przerwy. Zmiana domyślnego czasu dotyczy kolejnych propozycji; nie nadpisuje już zaplanowanych przerw.
- Postoje wpisane przy punktach wycieczki także mają zielony znacznik na mapie. Kliknij go, aby zmienić czas lub usunąć przerwę.
- Przerwy na kilometrze nie są nowymi punktami trasowania: ich edycja nie zmienia kilometrażu ani nie wysyła zapytań do serwera tras. Nie proponujemy kolejnej przerwy do 500 m od już zaplanowanej ani w ostatnich 500 m przed metą.
- Przerwy zapisują się z wycieczką i działają z cofaniem/ponawianiem zmian. Po zmianie przebiegu wycieczki przerwa „25 km” pozostaje na 25. kilometrze od startu nowego przebiegu. Jeśli skrócisz trasę przed ten kilometr, nie doliczamy takiej przerwy; jej wpis pozostaje do usunięcia lub ponownego wykorzystania po wydłużeniu trasy.
- Przy uruchomieniu mapa nadal pozostaje pusta. Wczytaj zapisaną wycieczkę ręcznie.

## Obsługa

- **Ustawienia → Twoje drogi i nawierzchnia**: preferowanie asfaltu/utwardzonych dróg, tras rowerowych i lokalnych dróg; unikanie DW/ruchliwych dróg. Dodatkowe preferencje działają w profilu Turystyczny / trekking. Pozostałe profile mają własne zasady i pokazują, że te przełączniki są nieaktywne. Zmiana preferencji przelicza trasę, jeśli automat jest włączony.
- **Ustawienia → Punkty trasy**: wpisz minuty postoju przy wybranym punkcie. Nie trzeba ponownie pobierać trasy. Postoje uwzględniane są w czasie całej wyprawy i w godzinach przyjazdu do kolejnych punktów. Postój na mecie zaczyna się po przyjeździe; nie opóźnia godziny przyjazdu na metę.
- **Tempo i godzina wyjazdu → Plan przejazdu i postoje**: lista godzin przyjazdu. Pole „Dodatkowe przerwy / zapas” dolicza ogólny zapas do czasu wyprawy, niezależnie od postojów przypisanych do punktów. Nie przypisujemy go arbitralnie do godzin w punktach.
- **Miejsca przy trasie**, pod mapą: wyszukaj sklepy, wodę pitną i miejsca odpoczynku do 500 m od śladu. Kategorie można ukrywać. Znaczniki S/W/O oznaczają sklep/wodę/odpoczynek; punkty trasy pozostają numerowane. „+ Postój” wstawia miejsce we właściwą kolejność, przypisuje 10 minut i uruchamia przeliczenie dojazdu. Czas można zmienić przy punkcie.
- **Zapisz trasę** zachowuje też postoje i preferencje. Przy uruchamianiu mapa nadal pozostaje pusta; zapisane wyprawy wczytuje się ręcznie. Starsze zapisy są obsługiwane. Zwykły eksport śladu GPX nie przenosi ustawień planera ani postojów.

## Co oznaczają preferencje

To preferencje wyboru drogi, a nie zakazy. BRouter korzysta z klas i opisów OpenStreetMap. Nie zapewniamy ścisłego wykluczenia każdej administracyjnej drogi wojewódzkiej w Polsce. Odcinki przy punktach lub bez alternatywy mogą nadal prowadzić taką drogą. Szlak rowerowy może być nieutwardzony; preferencja asfaltu nie gwarantuje całej trasy po asfalcie. Brak danych jest nadal wyraźnie oznaczony.

Wyszukiwanie miejsc korzysta z publicznego Overpass API (instancja Private.coffee). Obejmuje m.in. sklepy spożywcze/piekarnie, punkty wody pitnej, miejsca piknikowe, wiaty i miejsca odpoczynku. Wyniki nie stanowią pełnego spisu obiektów w terenie. Odległość od trasy jest liczona w linii prostej, nie jako dojazd. Potwierdź dostępność i oznakowanie wody na miejscu. Limit odpowiedzi serwera, jeśli zostanie osiągnięty, jest sygnalizowany; duże listy są skracane w panelu, z zachowaniem znaczników na mapie.

Wyszukiwanie uruchamia się na żądanie. Wyniki są buforowane, żądania mają odstęp co najmniej 30 sekund, limit czasu i respektują Retry-After. Błąd lub przerwanie wyszukiwania miejsc nie usuwa wyznaczonej trasy. Kolejka trasowania i ochrona po HTTP 403/429 pozostają aktywne.

Dokumentacja źródeł:

- [Parametry API BRouter](https://github.com/abrensch/brouter/blob/master/brouter-server/src/main/java/btools/server/request/ServerHandler.java)
- [Profil trekking i jego przełączniki](https://github.com/abrensch/brouter/blob/master/misc/profiles2/trekking.brf)
- [Wyszukiwanie wokół linii w Overpass API](https://dev.overpass-api.de/overpass-doc/en/full_data/polygon.html)
- [Publiczne instancje Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances)

## Wgranie na GitHub Pages

Rozpakuj paczkę. Wgraj `index.html`, cały folder `assets`, folder `tests` i ten README do głównego katalogu repozytorium `gemciu83-lab/planer-tras-rowerowych`, zastępując istniejące pliki. Nie wgrywaj samego ZIP-a ani dodatkowego folderu nadrzędnego. Zatwierdź zmianę przyciskiem Commit changes i poczekaj na zakończenie wdrożenia Pages. Tytuł karty nowej wersji to „Planer tras rowerowych 2.8.0”.

## Weryfikacja

Testy lokalne (Node.js): `node tests/planner.test.cjs`. Obejmują dotychczasowe zachowanie trasowania i nowe preferencje, walidację postojów, kolejność godzin przyjazdu, zgodność starszych zapisów, projekcję miejsc na trasę, dodawanie przystanków oraz zachowanie czasów podczas przesuwania, odwracania i usuwania punktów. Zewnętrzne serwery mogą okresowo odmawiać lub opóźniać odpowiedzi; testy lokalne nie gwarantują ich dostępności.

