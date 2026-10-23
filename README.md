# Planer tras rowerowych 3.7

Nowa wersja: po ponownym otwarciu strona nie przywraca parametrów poprzedniej sesji. Zapamiętuje tylko masę rowerzysty. Nowa wyprawa zaczyna z bagażem 2 kg, profilem Turystyczny / trekking oraz rowerem Trekking / miejski. Zachowano ciemne listy otwierane do góry i dolne kafelki 40 px.

## Parametry przy uruchomieniu

- Masa rowerzysty: ostatnia prawidłowo zapamiętana wartość, a przy pierwszej wizycie 70 kg. Ze starszej wersji przenoszona jest tylko ta masa.
- Bagaż: 2 kg; profil trasy: Turystyczny / trekking; rodzaj roweru: Trekking / miejski.
- Pozostałe wartości nowej sesji: tempo 16 km/h, masa roweru 22 kg, dodatkowy zapas postojów 0 min, pozycja domyślna, wiatr ręczny 0 km/h. Preferencje dróg są wyzerowane. Propozycje odpoczynku wracają do 25 km i 10 minut.
- Zmiany tych pól działają podczas bieżącej sesji i w historii cofania. Jeśli ręcznie zapiszesz wycieczkę, jej parametry nadal zostaną zachowane i można je przywrócić przez świadome wczytanie tej wycieczki. Zapisane wyprawy nie są usuwane.
- Mapa nadal zaczyna bez poprzedniej trasy; automatyczny GPS może ustawić start S. Ustawienia wyglądu, takie jak schowanie paska, są nadal zapamiętywane niezależnie od parametrów wycieczki. Zachowano też wybór automatycznego przeliczania oraz wymaganą przerwę po odmowie serwera.

## Wąski pasek parametrów

- Na dole mapy są obok siebie: **profil trasy, tempo, masa rowerzysty, masa roweru, masa bagażu, rodzaj roweru i Postoje**. Każdy kafelek jest osobnym elementem o wysokości 40 px. Pola nie mają drugiego obramowanego pudełka wewnątrz. Wspólny rząd zaczyna się 12 px od lewej krawędzi mapy, a kończy przyciskiem PNG 12 px od prawej. Kafelki wykorzystują dostępne miejsce, bez ograniczenia szerokości do 850 px i bez dodatkowego przycisku koła zębatego. Na ekranach szerszych niż 950 px wszystkie narzędzia są w jednej linii; na mniejszych ekranach parametry przechodzą ponad przyciski, a na telefonach do kolejnych rzędów.
- Listy **Profil trasy** i **Rodzaj roweru** mają własne ciemne menu, niezależne od białych okien systemowych. Otwierają się nad polem. Wybierz opcję myszą lub strzałkami i Enter; Escape zamyka bez zmiany, Tab przechodzi do następnego pola. Kliknięcie poza listą także ją zamyka. Zaznaczenie aktywnego pola jest na obwodzie całego kafelka, więc nie zakrywa podpisu.
- **Profil trasy** wybiera sposób wyznaczania drogi: turystyczny, szosa, MTB lub ręczne linie. Zmiana korzysta z tego samego automatu co pole w górnych ustawieniach. **Rodzaj roweru** jest szóstym kafelkiem: trekking/miejski, gravel, szosowy lub MTB; zmienia model energii bez pobierania nowej geometrii. Pozycja jazdy, wiatr i szczegółowe rozbicie kalorii pozostają w **Ustawieniach** u góry strony.
- **Bagaż · kg** jest osobnym polem tuż po **Rower · kg**. Edycja działa od razu i jest zsynchronizowana z ustawieniami oraz zapisem wycieczki.
- Kliknij **×**, aby schować cały dolny pasek do małej zakładki **⚙ Parametry**. Kliknięcie zakładki przywraca wszystkie pola. Kafelki dystansu, kalorii i czasu po prawej pozostają widoczne.
- Klawisz **P** także przełącza cały panel. Skrót nie działa podczas wpisywania danych, używania list wyboru ani w otwartym oknie dialogowym. Widoczność panelu jest zapamiętywana niezależnie od trasy i historii cofania. Starszy zapis widoczności kafelków jest obsługiwany.
- Chowanie i przywracanie nie usuwa punktów, nie zmienia parametrów ani nie wyznacza ponownie trasy. Parametry i wyniki pozostają zsynchronizowane z ustawieniami u góry.
- **P Postoje** należy do dolnego paska parametrów i chowa się razem z nim. Pełny ekran i PNG pozostają widoczne po prawej. Dopasowanie całej trasy i początkowe centrowanie GPS uwzględniają pasek.
- Po uruchomieniu nadal nie wczytujemy poprzedniej trasy. Styl mapy i przycisk GPS pozostają u góry mapy.
- Znaczniki zaplanowanych postojów i propozycji mają literę **P**. Propozycje są żółte, zaplanowane postoje zielone; podpis nadal wyjaśnia rodzaj przerwy. Renderer PNG także używa P.

## Bagaż, wiatr i kalorie

- **Ustawienia → Rowerzysta, rower i bagaż**: masa roweru bez bagażu, osobna masa sakw/plecaka/ekwipunku i pozycja na rowerze. Masę bagażu zmienisz także w **dolnym panelu mapy**. Nowa sesja zaczyna z bagażem 2 kg; starsze zapisane wyprawy bez pola bagażu nadal zachowują 0 kg. Jeśli wcześniej wpisano rower wraz z sakwami, najpierw odejmij sakwy od masy roweru.
- **Pozycja** zmienia założony opór powietrza: wyprostowana, turystyczna lub mocno pochylona. Opcja domyślna korzysta z dotychczasowego ustawienia dla typu roweru. Opór toczenia pozostaje zależny od typu roweru, a nie od udziału nawierzchni z OSM.
- **Ustawienia → Wiatr i kalorie**: ręcznie wpisz prędkość wiatru i kierunek, **z którego wieje**. N = z północy, W = z zachodu. Domyślne 0 km/h oznacza wyraźne założenie bez wiatru. Dla każdego odcinka obliczamy kierunek jazdy i względny wektor powietrza, również przy bocznym wietrze. Silny wiatr w plecy może ograniczyć potrzebę pedałowania; nie daje ujemnych kalorii.
- **Pobierz wiatr dla trasy**: jeden przycisk pobiera godzinną prognozę Open-Meteo dla 2–5 miejsc wzdłuż wyznaczonej trasy. Współrzędne wysyłane są zaokrąglone do 0,001°. Pobieranie odbywa się po kliknięciu, nie automatycznie przy każdym punkcie. Wymaga internetu i daty wyjazdu od teraz do 15 dni naprzód. Po sukcesie wybierany jest tryb prognozy.
- Prognoza dobierana jest do przewidywanej godziny na każdym odcinku, z uwzględnieniem wcześniejszych zaplanowanych postojów. Ogólny dodatkowy zapas nie ma przypisanego miejsca, więc nie przypisujemy go arbitralnie do konkretnej godziny na trasie. Wiatr zmienia energię potrzebną do utrzymania wpisanego tempa; nie zmienia wpisanego tempa ani ETA.
- W trybie prognozy brak danych, niewystarczający zakres godzin, zmiana geometrii lub prognoza starsza niż godzinę wymagają pobrania danych ponownie. Nie pokazujemy wtedy kalorii policzonych przy udawanym bezwietrzu. Można przełączyć na wiatr ręczny. Pobrana prognoza pozostaje w pamięci karty, nie jest zapisywana jako trwała prognoza w wycieczce; po ponownym otwarciu należy pobrać ją jeszcze raz.
- **Aktywne**: modelowany wysiłek potrzebny do jazdy ponad spoczynek. Korzystamy z pracy mechanicznej, sprawności napędu 97% i założonej **sprawności netto 24%**. Masa mechaniczna = rowerzysta + rower + bagaż. **Całkowite** dodają do aktywnych dokładnie jeden wydatek spoczynkowy samego rowerzysty, około 1 kcal/kg/h przez czas jazdy i postojów. Nie doliczamy masy roweru ani sakw do metabolizmu.
- Na mapie główny wynik to aktywne, a mniejszy podpis pokazuje całkowite. W ustawieniach jest rozbicie spoczynkowych na jazdę i postoje. Wyniki główne zaokrąglamy do 10 kcal; są przybliżeniem, nie pomiarem ani obietnicą dokładności fizjologicznej. Sprawność netto nie jest stała u każdej osoby. Nie modelujemy kosztu kadencji, rozpędzania ani dodatkowej pracy organizmu podczas toczenia bez pedałowania.
- Prognoza dotyczy standardowego wiatru na 10 m; osłona lasów, zabudowy i lokalne porywy zmieniają faktyczny wiatr odczuwany przez rowerzystę. Model ma stałą gęstość powietrza i uproszczoną aerodynamikę, bez wspomagania elektrycznego.
- Zmiana mas, pozycji, wiatru i postojów **nie pobiera ponownie geometrii trasy**. Ustawienia pozostają w bieżącej sesji, ręcznie zapisanych wyprawach oraz historii cofania/ponawiania. Automatycznie między sesjami zachowywana jest tylko masa rowerzysty.

Źródła założeń: [wydatek spoczynkowy 1 MET](https://pacompendium.com/), [różnica między sprawnością netto i brutto w badaniu jazdy przy 50 W](https://pmc.ncbi.nlm.nih.gov/articles/PMC5867372/), [model fizyczny jazdy](https://pubmed.ncbi.nlm.nih.gov/7615475/), [API i jednostki prognozy Open-Meteo](https://open-meteo.com/en/docs). Wyniki modelu planera nie są bezpośrednią kopią metody MET ani wyniku konkretnego zegarka.

## Szybszy start i obliczenia

- Lokalizacja uruchamia się automatycznie. Pierwszy poprawny pomiar od razu ustawia **S** i pozwala kliknąć punkt **1**. Usunięto dodatkowe oczekiwanie 1,2–8 sekund na dokładniejszy pomiar.
- Jeśli przeglądarka udostępnia pomiar z ostatniej minuty, planer może użyć go od razu. Starszy pomiar jest opisany jako „ostatni pomiar” wraz z jego wiekiem w ustawieniach lokalizacji. Równolegle pobierana jest świeża pozycja. Nie zapisujemy współrzędnych GPS w nowym trwałym magazynie.
- GPS doprecyzowuje samotny, nietknięty start w tle przez maksymalnie 15 sekund. Po dodaniu punktu 1 albo ręcznej zmianie startu nie przesuwa już trasy. „Moja lokalizacja” pozwala świadomie ponownie ustawić S. Automatyczny pomiar nie nadpisuje wczytanej wycieczki.
- Pierwsza wizyta wymaga zgody na lokalizację. Bez dostępnego niedawnego pomiaru trzeba poczekać na urządzenie. Brak zgody lub pomiaru pozwala ustawić start ręcznie; rzeczywistego GPS nie można zagwarantować natychmiast.
- Automat czeka **0,6 s** od ostatniej zmiany punktów, wcześniej 1,5 s. Seria szybkich kliknięć nadal tworzy jedno zapytanie dla najnowszego układu punktów.
- Przy dopisaniu punktu na końcu planer wykorzystuje zapisany początek trasy i pobiera tylko końcowy odcinek. Dokładne powtórzenie trasy może skorzystać z pamięci bez pobierania. Pamięć trwa do 15 minut w otwartej karcie i uwzględnia profil oraz preferencje dróg. Gdy brakuje dwóch odcinków, wysyłane jest jedno pełne zapytanie zamiast dwóch osobnych. Niezgodne połączenie geometrii powoduje pełne przeliczenie.
- Zachowano pojedynczą kolejkę zapytań, minimum 5 sekund przerwy po odpowiedzi i respektowanie HTTP 403/429 oraz Retry-After. Czas odpowiedzi serwera i długich tras nadal zależy od usługi i sieci.
- Ostatnia wycieczka nadal nie wczytuje się automatycznie. Start S z GPS nie jest przywróceniem poprzedniej trasy.

## Wgranie na GitHub Pages

Najpierw zapisz bieżącą trasę. Rozpakuj ZIP i wgraj do głównego katalogu repozytorium **index.html oraz cały folder assets**, zastępując poprzednią wersję. Pliki tests, README.md i TESTY.md można również zachować w repozytorium. Paczka nie zawiera lokalnych atrap GPS/pogody ani serwera testowego. W tytule strony i metadanych znajduje się numer **3.7.0**. Sama zmiana końcówki adresu nie podmienia plików aplikacji. Po opublikowaniu nowych plików otwórz stronę w nowej karcie; wycieczkę wczytaj ręcznie.

## Nowość: przerwy na mapie

- Po wyznaczeniu lub wczytaniu trasy pojawiają się żółte znaczniki **„Odpoczynek?”**, domyślnie co 25 km. To propozycje pozycji na śladzie, a nie potwierdzone sklepy, ławki czy miejsca odpoczynku w terenie.
- Kliknij ikonę lub jej podpis, ustaw czas i wybierz **„Zaplanuj ten postój”**. Znacznik zmieni się na zielony **„Postój 10 min”**. Dopiero zaakceptowany postój wpływa na czas wyprawy i kolejne godziny przyjazdu.
- W dolnym pasku parametrów mapy jest przycisk **„P Postoje”**. Zmienisz tam odstęp (domyślnie 25 km), domyślny czas przerwy (10 min), schowasz propozycje i usuniesz zaplanowane przerwy. Zmiana domyślnego czasu dotyczy kolejnych propozycji; nie nadpisuje już zaplanowanych przerw.
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

Rozpakuj paczkę. Wgraj `index.html`, cały folder `assets`, folder `tests` i ten README do głównego katalogu repozytorium `gemciu83-lab/planer-tras-rowerowych`, zastępując istniejące pliki. Nie wgrywaj samego ZIP-a ani dodatkowego folderu nadrzędnego. Zatwierdź zmianę przyciskiem Commit changes i poczekaj na zakończenie wdrożenia Pages. Tytuł karty nowej wersji to „Planer tras rowerowych 3.7.0”.

## Weryfikacja

Testy lokalne (Node.js): `node tests/planner.test.cjs`. Obejmują dotychczasowe zachowanie trasowania i nowe preferencje, walidację postojów, kolejność godzin przyjazdu, zgodność starszych zapisów, projekcję miejsc na trasę, dodawanie przystanków oraz zachowanie czasów podczas przesuwania, odwracania i usuwania punktów. Zewnętrzne serwery mogą okresowo odmawiać lub opóźniać odpowiedzi; testy lokalne nie gwarantują ich dostępności.

