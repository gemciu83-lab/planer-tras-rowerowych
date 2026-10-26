# Audyt kalorii na długich trasach — 26.10.2026

Przegląd kodu wersji 3.9 oraz badań. Wersja 3.10 naprawia błąd podjazdów i ujawnia brakujące dane; nie jest kalibracją fizjologiczną do konkretnego rowerzysty ani zegarka.

## Wniosek dotyczący 123 km i 3600 kcal

Taki wynik jest możliwy, ale sam dystans nie wystarcza, żeby ocenić jego trafność. Nie otrzymano jeszcze czasu jazdy, masy rowerzysty w maju, przewyższeń ani informacji, czy Huawei pokazał aktywne, czy całkowite kalorie. Nie zmieniono współczynników, żeby wymusić 3600 kcal na dowolnej trasie 123 km.

Huawei wyjaśnia, że wynik pojedynczego treningu może obejmować kalorie aktywne i spoczynkowe; na części urządzeń pokazywane są obie wartości. W planerze duża liczba oznacza aktywne, mniejsza całkowite. Trzeba porównywać identyczne kategorie. [Informacja producenta](https://consumer.huawei.com/uk/support/content/en-gb15966741/).

## Znaleziony i poprawiony błąd

Filtr medianowy traktował szczyt pomiędzy dwoma sąsiednimi punktami jako pojedynczy skok wysokości niezależnie od odległości między punktami. Przy rzadkim GPX potrafił usunąć prawdziwy podjazd długi na kilkaset metrów lub więcej.

W 3.10 ten filtr działa tylko wtedy, gdy obaj sąsiedzi są nie dalej niż 15 m od punktu. Nadal usuwa pojedyncze skoki w gęstym zapisie GPS. Szerokie szczyty w rzadkim GPX zostają zachowane. Wygładzanie w oknie 30 m i próg naliczania sumy podejść 3 m pozostają. Rzadki GPX z błędnymi wysokościami nadal może dawać błędną sumę — nie można rozpoznać rzeczywistego terenu wyłącznie z trzech liczb.

Testowy GPX: 123 km, wysokości 100 → 1100 → 100 → 100 m, odcinki 25 + 25 + 73 km; rowerzysta 68 kg, rower 20 kg, bagaż 2 kg, trekking, 18 km/h, bez wiatru. Stara wersja liczyła 0 m podjazdów, 2052 aktywne i 2517 całkowitych kcal. Poprawiona liczy 1000 m podjazdów, 2541 aktywnych i 3006 całkowitych kcal. To syntetyczny test błędu, nie odtworzenie majowego treningu użytkownika.

## Sprawdzenie obecnego wzoru

Masa mechaniczna to rowerzysta + rower + bagaż. Uwzględnione są opór toczenia, aerodynamika wraz z kierunkiem wiatru oraz wysokości, jeśli są dostępne. Praca jest przeliczana przez sprawność napędu 97% i przyjętą sprawność netto 24%. Kalorie całkowite dodają jeden wydatek spoczynkowy samego rowerzysty: około 1 kcal/kg/h przez jazdę i postoje. Masa roweru i bagażu nie jest doliczana do metabolizmu.

Nie znaleziono błędu przeliczenia metrów, czasu ani dublowania spoczynku. Dwa identyczne odcinki dają dwa razy więcej energii. Postój zwiększa tylko składnik spoczynkowy, nie wysiłek aktywny.

24% jest założeniem, nie indywidualnym pomiarem. W badaniu 168 osób przy obciążeniu 50 W średnia sprawność netto grup wynosiła około 23–25%; wyniki poszczególnych osób różniły się wyraźnie. Badanie jednego obciążenia nie potwierdza takiej samej sprawności dla każdego tempa, kadencji i wielogodzinnej jazdy. [Badanie sprawności](https://pmc.ncbi.nlm.nih.gov/articles/PMC5867372/).

Sprawność netto oraz model z osobnym kosztem pedałowania i sprawnością przyrostową to różne opisy. Dodanie stałego kosztu pedałowania do dotychczasowych 24% bez ponownego zdefiniowania modelu mogłoby częściowo policzyć ten koszt ponownie. Badania cykloergometryczne potwierdzają wpływ mocy i szybkości ruchu nóg, ale nie dostarczają jednej uniwersalnej poprawki do każdej wycieczki. [Badanie kosztu ruchu nóg](https://pubmed.ncbi.nlm.nih.gov/12183473/), [walidacja równania cykloergometrycznego](https://pubmed.ncbi.nlm.nih.gov/8371659/).

## Scenariusze porównawcze

Wszystkie poniższe wartości to wyniki tego samego planera dla 123 km, rowerzysty 68 kg, roweru trekkingowego 20 kg i bagażu 2 kg. Bez postojów, o ile nie podano inaczej. W scenariuszu pagórkowatym przyjęto podjazd 1000 m na 25 km, zjazd 1000 m na 25 km i 73 km płaskiego odcinka.

| Warunki | Czas jazdy | Aktywne kcal | Całkowite kcal |
|---|---:|---:|---:|
| 18 km/h, płasko, bez wiatru | 6 h 50 min | 2052 | 2517 |
| 18 km/h, 1000 m podjazdów i zjazdów, bez wiatru | 6 h 50 min | 2541 | 3006 |
| 23 km/h, 1000 m podjazdów i zjazdów, bez wiatru | ok. 5 h 21 min | 3126 | 3490 |
| 18 km/h, płasko, stale 10 km/h pod wiatr | 6 h 50 min | 3699 | 4164 |
| 18 km/h, płasko, bez wiatru + 60 min postoju | 6 h 50 min jazdy | 2052 | 2585 |

Stały wiatr czołowy nie opisuje typowej pętli; ostatni scenariusz wiatrowy pokazuje wrażliwość wzoru. Suma podjazdów też nie określa sama całej geometrii. Te wyliczenia nie są pomiarem spalania użytkownika.

## Pozostałe ograniczenia i dalsze dopracowanie

- Odcinki bez wysokości są obecnie liczone bez zmian wysokości. 3.10 podaje procent dystansu z brakującymi wysokościami, zamiast pozostawiać to jedynie w ogólnej notce. Uzupełnienie profilu jest pierwszym krokiem, jeśli trasa była pagórkowata.
- Brak wiatru to jawne założenie, nie pomiar pogody. Prognoza dotyczy wiatru na 10 m i nie uwzględnia w pełni osłony drzew i budynków.
- Stałe średnie tempo nie odtwarza częstych przyspieszeń, hamowania, rzeczywistego rozkładu prędkości na podjazdach i zjazdach, kadencji ani indywidualnego kosztu wysiłku.
- Długa jazda może zmieniać sprawność. W badaniu 12 elitarnych kolarzy podczas 4 godzin wysiłku sprawność brutto spadła z około 19% do 18%. To nie jest podstawa do dodawania uniwersalnego procentu do wszystkich długich tras ani do utożsamiania odczuwanego zmęczenia z proporcjonalnym wzrostem kcal. [Badanie długiego wysiłku](https://pubmed.ncbi.nlm.nih.gov/31693997/).
- Zegarek też szacuje energię. Badanie Huawei Band 8 podczas jazdy na ergometrze wykazało niedoskonałą zgodność z kalorymetrią. Wyników dla 20 młodych kobiet i tego konkretnego urządzenia nie można przenieść wprost na inny zegarek oraz trasę 123 km. [Badanie pomiarów z zegarków](https://pubmed.ncbi.nlm.nih.gov/40986546/).

Następny krok to porównanie tego samego przejazdu: czas samej jazdy, postoje, masa ciała, rower i bagaż, profil wysokości, wiatr oraz kategoria kalorii w Huawei. Średnie tętno może pomóc opisać intensywność, ale samo nie stanowi wzorca kcal. Ewentualne dopasowanie do zegarka musi być nazwane dopasowaniem do jego wskazań, a nie dowodem dokładności fizjologicznej.
