export type UploadedReservationRowShape = {
  Status?: string;
  "Check in Date"?: string;
  "Check out Date"?: string;
  "Accommodation Total"?: string;
  "Grand Total"?: string;
  "Reservation Number"?: string;
  "Third Party Confirmation Number"?: string;
  Source?: string;
  "Reservation Date"?: string;
};

export function detectDelimiterFromHeaderLine(headerLine: string): "," | "\t" {
  return headerLine.includes("\t") ? "\t" : ",";
}

export function normalizeLooseKey(input: string) {
  return input.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getValue(row: Record<string, unknown>, candidates: string[]): string | undefined {
  for (const candidate of candidates) {
    if (candidate in row) {
      const value = row[candidate];
      if (value == null) return undefined;
      if (typeof value === "string") return value;
      return String(value);
    }
  }
  return undefined;
}

export function pickReservationFieldsLoose(
  row: Record<string, unknown>,
): UploadedReservationRowShape {
  const entries = Object.entries(row);
  const looseMap = new Map<string, string>();
  entries.forEach(([key]) => {
    looseMap.set(normalizeLooseKey(key), key);
  });

  const pickLoose = (candidateLooseKeys: string[]) => {
    const candidates = candidateLooseKeys
      .map((key) => looseMap.get(key))
      .filter((value): value is string => Boolean(value));
    return getValue(row, candidates);
  };

  return {
    Status: pickLoose(["status"]),
    "Check in Date": pickLoose(["checkindate", "checkin", "arrivaldate", "arrival"]),
    "Check out Date": pickLoose([
      "checkoutdate",
      "checkout",
      "departuredate",
      "departure",
    ]),
    "Accommodation Total": pickLoose([
      "accommodationtotal",
      "roomtotal",
      "roomrevenue",
      "lodgingtotal",
    ]),
    "Grand Total": pickLoose(["grandtotal", "total", "totalamount"]),
    "Reservation Number": pickLoose([
      "reservationnumber",
      "reservationid",
      "reservation",
    ]),
    "Third Party Confirmation Number": pickLoose([
      "thirdpartyconfirmationnumber",
      "thirdpartyconfirmation",
      "thirdpartyconfirmationid",
    ]),
    Source: pickLoose(["source", "channel"]),
    "Reservation Date": pickLoose(["reservationdate", "bookingdate", "bookeddate"]),
  };
}

