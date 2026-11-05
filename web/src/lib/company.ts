/**
 * BDI's own details for printed documents, as on Mercury's delivery note
 * (Зарлагын баримт). Change them here if the name or bank account changes.
 */
export const COMPANY = {
  name: "Бадруун дэвжих интернэйшнл ХХК",
  bank: "Хаан банк 510005005622139361",
} as const;

/** The form header Mercury prints on every delivery note (accounting form БМ-3х). */
export const DELIVERY_NOTE_FORM = {
  code: "НХМаягт БМ-3х",
  basis: "Сангийн сайдын 2017 оны 12 сарын 05 өдрийн 347 тоот тушаалын хавсралт",
} as const;
