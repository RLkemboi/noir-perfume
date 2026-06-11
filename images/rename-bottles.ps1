# Renames bottle shot images to short, searchable kebab-case names.
# First match wins; duplicates of the same fragrance get -2/-3 suffixes.
$dir = Join-Path $PSScriptRoot "bottle shots"

$rules = @(
  @{ pat = '*Acqua Di Gio 100ml*';        name = 'adg-parfum' }
  @{ pat = '*gio*pour homme*';            name = 'adg-pour-homme' }
  @{ pat = '*Acqua Di Gio Absolu*';       name = 'adg-absolu' }
  @{ pat = '*Profumo*';                   name = 'adg-profumo' }
  @{ pat = '*Profondo*';                  name = 'adg-profondo' }
  @{ pat = '*Stronger With You Parfum*';  name = 'swy-parfum' }
  @{ pat = 'SWY Parfum*';                 name = 'swy-parfum' }
  @{ pat = '*With You Amber*';            name = 'swy-amber' }
  @{ pat = '*Powerfully*';                name = 'swy-powerfully' }
  @{ pat = '*Intensely*';                 name = 'swy-intensely' }
  @{ pat = 'SWY Absolutely*';             name = 'swy-absolutely' }
  @{ pat = 'SWY Power of you*';           name = 'power-of-you' }
  @{ pat = '*decision*';                  name = 'amouage-decision' }
  @{ pat = '*Sequence*';                  name = 'amouage-sequence' }
  @{ pat = '*Interlude Black Iris*';      name = 'amouage-interlude-black-iris' }
  @{ pat = '*Interlude Man*';             name = 'amouage-interlude-man' }
  @{ pat = '*Reflection 45*';             name = 'amouage-reflection-45' }
  @{ pat = '*Outlands*';                  name = 'amouage-outlands' }
  @{ pat = '*Purpose 50*';                name = 'amouage-purpose-50' }
  @{ pat = '*Remain*';                    name = 'amouage-remain' }
  @{ pat = '*Beach Hut*';                 name = 'amouage-beach-hut-man' }
  @{ pat = '*Myths Man*';                 name = 'amouage-myths-man' }
  @{ pat = '*Ghost absolu*';              name = 'byredo-mojave-ghost' }
  @{ pat = '*Rouge Chaotique*';           name = 'byredo-rouge-chaotique' }
  @{ pat = '*Vanille Antique*';           name = 'byredo-vanille-antique' }
  @{ pat = '*Teriaq*';                    name = 'lattafa-teriaq-intense' }
  @{ pat = 'Emeer*';                      name = 'lattafa-emeer' }
  @{ pat = '*Khamrah Waha*';              name = 'lattafa-khamrah-waha' }
  @{ pat = '*Khamrah*';                   name = 'lattafa-khamrah' }
  @{ pat = '*mashrabya*';                 name = 'lattafa-mashrabya' }
  @{ pat = '*Musamam*';                   name = 'lattafa-musamam-black-intense' }
  @{ pat = 'Lattafa Atlas*';              name = 'lattafa-atlas' }
  @{ pat = '*Najdia*';                    name = 'lattafa-najdia-intense' }
  @{ pat = '*Yara Bourbon*';              name = 'lattafa-asad-bourbon' }
  @{ pat = '*Yara Moi*';                  name = 'lattafa-yara-moi' }
  @{ pat = 'Yara by Lattafa*';            name = 'lattafa-yara' }
  @{ pat = '*Hawas elixir*';              name = 'hawas-elixir' }
  @{ pat = 'temp-hawas-german*';          name = 'hawas-elixir' }
  @{ pat = '*Hawas Ice*';                 name = 'hawas-ice' }
  @{ pat = '*Atlantis*';                  name = 'hawas-atlantis' }
  @{ pat = '*clat*';                      name = 'hawas-eclat' }
  @{ pat = '*Hawas london*';              name = 'hawas-london' }
  @{ pat = '*Hawas verde*';               name = 'hawas-verde' }
  @{ pat = '*Hawas Black*';               name = 'hawas-black' }
  @{ pat = '*Hawas Diva*';                name = 'hawas-diva' }
  @{ pat = '*Hawas Fire*';                name = 'hawas-fire' }
  @{ pat = '*Kobra*';                     name = 'hawas-kobra' }
  @{ pat = '*Tropical*';                  name = 'hawas-tropical' }
  @{ pat = '*Viper*';                     name = 'hawas-viper' }
  @{ pat = '*Hawas For Her*';             name = 'hawas-for-her' }
  @{ pat = '*Hawas for Him*';             name = 'hawas-for-him' }
  @{ pat = '*Qissa*';                     name = 'caliph-qissa-lunar' }
  @{ pat = '*imperial valley*';           name = 'gissah-imperial-valley' }
  @{ pat = '*MAVRO*';                     name = 'gissah-mavro' }
  @{ pat = '*Lift Me Up*';                name = 'initio-lift-me-up' }
  @{ pat = '*Atomic Rose*';               name = 'initio-atomic-rose' }
  @{ pat = '*Blessed Baraka*';            name = 'initio-blessed-baraka' }
  @{ pat = '*Musk Therapy*';              name = 'initio-musk-therapy' }
  @{ pat = '*Oud For Greatness*';         name = 'initio-oud-for-greatness' }
  @{ pat = '*Paragon*';                   name = 'initio-paragon' }
  @{ pat = '*side effect*';               name = 'initio-side-effect' }
  @{ pat = '*Lavender Extreme*';          name = 'tf-lavender-extreme' }
  @{ pat = '*Plum Japonais*';             name = 'tf-plum-japonais' }
  @{ pat = '*sole di positano*';          name = 'tf-sole-di-positano-acqua' }
  @{ pat = '*Amber Intrigue*';            name = 'tf-amber-intrigue' }
  @{ pat = '*Azure Lime*';                name = 'tf-azure-lime' }
  @{ pat = '*Neroli Portofino*';          name = 'tf-neroli-portofino' }
  @{ pat = '*Leather*';                   name = 'tf-ombre-leather' }
  @{ pat = '*Soleil Blanc*';              name = 'tf-soleil-blanc' }
  @{ pat = '*Y Elixir*';                  name = 'ysl-y-elixir' }
  @{ pat = "*L' ELIXIR*";                 name = 'ysl-y-elixir' }
  @{ pat = 'YSL 6*';                      name = 'ysl-6-place-saint-sulpice' }
  @{ pat = '*TUXEDO*';                    name = 'ysl-tuxedo' }
  @{ pat = '*Y Eau de Parfum*';           name = 'ysl-y-edp' }
  @{ pat = '*city of stars*';             name = 'lv-city-of-stars' }
  @{ pat = '*Meteore*';                   name = 'lv-meteore' }
  @{ pat = '*pure ambre*';                name = 'lv-ambre-levant' }
  @{ pat = 'Versacce EDP*';               name = 'versace-eros-flame' }
  @{ pat = '*Eau Fraiche Extreme*';       name = 'versace-eau-fraiche-extreme' }
  @{ pat = '*Eau Fraiche Man*';           name = 'versace-eau-fraiche' }
  @{ pat = '*Eros EDT*';                  name = 'versace-eros' }
  @{ pat = '*Eros Energy*';               name = 'versace-eros-energy' }
  @{ pat = '*Eros Parfum*';               name = 'versace-eros-parfum' }
  @{ pat = '*Dylan Blue*';                name = 'versace-dylan-blue' }
  @{ pat = '*Spicebomb*';                 name = 'vr-spicebomb' }
)

$counts = @{}
$unmatched = @()

foreach ($file in (Get-ChildItem -LiteralPath $dir -File | Sort-Object Name)) {
  if ($file.Name -like 'rename-bottles*') { continue }
  $target = $null
  foreach ($r in $rules) {
    if ($file.Name -like $r.pat) { $target = $r.name; break }
  }
  if (-not $target) { $unmatched += $file.Name; continue }
  if ($counts.ContainsKey($target)) {
    $counts[$target]++
    $newName = "{0}-{1}.jpg" -f $target, $counts[$target]
  } else {
    $counts[$target] = 1
    $newName = "$target.jpg"
  }
  if ($file.Name -ne $newName) {
    Rename-Item -LiteralPath $file.FullName -NewName $newName
    Write-Output ("{0}  <=  {1}" -f $newName, $file.Name)
  }
}

Write-Output ""
Write-Output ("Renamed groups: {0}; total files: {1}" -f $counts.Count, ($counts.Values | Measure-Object -Sum).Sum)
if ($unmatched) { Write-Output "UNMATCHED:"; $unmatched | ForEach-Object { Write-Output "  $_" } }
