"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";
import { Bi } from "@/components/layout/bi";
import { fmtDate } from "@/lib/dates";
import { fmtQty } from "@/lib/format";
import { t, type MsgId } from "@/lib/i18n";
import type { Farm, IGP, Item, OGP, SIS, Slip } from "@/types/domain";

type Ctx = { items: Map<string, Item>; farms: Farm[] };

/**
 * The slip's fields and table in the paper slip's order. Used inside the print frame for print (S2)
 * and for the read-only slip on screen (F7 / A3).
 */
export function SlipBody({ slip, items, farms }: { slip: Slip } & Ctx) {
  switch (slip.type) {
    case "IGP":
      return <IgpBody slip={slip} items={items} farms={farms} />;
    case "OGP":
      return <OgpBody slip={slip} items={items} farms={farms} />;
    case "SIS":
      return <SisBody slip={slip} items={items} farms={farms} />;
  }
}

function Facts({ facts }: { facts: [MsgId, ReactNode][] }) {
  return (
    <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
      {facts.map(([label, value]) => (
        <div key={label} className="flex flex-wrap items-baseline gap-x-1">
          <dt className="font-semibold">
            <Bi id={label} inline />
          </dt>
          <dd dir="auto">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function H({ id, right }: { id: MsgId; right?: boolean }) {
  return (
    <th className={clsx(right && "text-right")}>
      <Bi id={id} />
    </th>
  );
}

function ItemName({ item }: { item?: Item }) {
  return (
    <>
      {item?.name}{" "}
      <span lang="ur" dir="rtl">
        {item?.nameUr}
      </span>
    </>
  );
}

const unitOf = (item?: Item) => (item ? t(`unit.${item.unit}`).en : "");
const farmName = (farms: Farm[], id?: string) => farms.find((f) => f.id === id)?.name ?? id ?? "";

function IgpBody({ slip, items, farms }: { slip: IGP } & Ctx) {
  const from = slip.source.kind === "farm" ? farmName(farms, slip.source.farmId) : slip.source.ms;
  return (
    <>
      <Facts
        facts={[
          ["igp.biltyNo", slip.biltyNo],
          ["igp.truckNo", slip.truckNo],
          ["igp.driverName", slip.driverName],
        ]}
      />
      <p className="mb-2">
        <span className="font-semibold">
          <Bi id="igp.receivedFrom" inline />:
        </span>{" "}
        <span dir="auto">{from}</span>
      </p>
      <Facts
        facts={[
          ["igp.demandNo", slip.demandNo],
          ["igp.challanNo", slip.challanNo],
          ["igp.challanDate", slip.challanDate ? fmtDate(slip.challanDate) : ""],
        ]}
      />
      <table>
        <thead>
          <tr>
            <H id="line.srNo" />
            <H id="line.item" />
            <H id="line.unit" />
            <H id="line.qtyChallan" right />
            <H id="line.qtyReceived" right />
            <H id="line.weight" right />
          </tr>
        </thead>
        <tbody>
          {slip.lines.map((l, i) => {
            const item = items.get(l.itemId);
            const short = l.qtyChallan - l.qtyReceived;
            return (
              <tr key={i} className={clsx(short > 0 && "slip-short")}>
                <td className="num">{i + 1}</td>
                <td>
                  <ItemName item={item} />
                </td>
                <td>{unitOf(item)}</td>
                <td className="num text-right">{fmtQty(l.qtyChallan)}</td>
                <td className="num text-right">
                  {fmtQty(l.qtyReceived)}
                  {short > 0 && (
                    <div className="text-xs font-semibold">
                      <Bi id="msg.shortBy" values={{ n: fmtQty(short) }} inline />
                    </div>
                  )}
                </td>
                <td className="num text-right">{l.weightKg ? `${fmtQty(l.weightKg)} kg` : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

function OgpBody({ slip, items, farms }: { slip: OGP } & Ctx) {
  const to = slip.to.kind === "farm" ? farmName(farms, slip.to.farmId) : slip.to.ms;
  const reason: MsgId | null =
    slip.to.kind === "outside" ? (({ repair: "ogp.repair", return: "ogp.return", other: "ogp.otherReason" }) as const)[slip.to.reason ?? "other"] : null;
  return (
    <>
      <p className="mb-2">
        <span className="font-semibold">M/s</span> <span dir="auto">{to}</span>
        {reason && (
          <span className="ml-2">
            (<Bi id={reason} inline />)
          </span>
        )}
        <br />
        <span className="text-xs">is allowed to take out the following items</span>
      </p>
      <Facts
        facts={[
          ["igp.driverName", slip.driverName],
          ["ogp.vehicleNo", slip.vehicleNo],
        ]}
      />
      <table>
        <thead>
          <tr>
            <H id="line.srNo" />
            <H id="line.description" />
            <H id="line.unit" />
            <H id="line.qty" right />
            <H id="line.weight" right />
          </tr>
        </thead>
        <tbody>
          {slip.lines.map((l, i) => {
            const item = items.get(l.itemId);
            return (
              <tr key={i}>
                <td className="num">{i + 1}</td>
                <td>
                  <ItemName item={item} />
                </td>
                <td>{unitOf(item)}</td>
                <td className="num text-right">{fmtQty(l.qty)}</td>
                <td className="num text-right">{l.weightKg ? `${fmtQty(l.weightKg)} kg` : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

function SisBody({ slip, items, farms }: { slip: SIS } & Ctx) {
  const farm = farms.find((f) => f.id === slip.farmId);
  const shedName = (id?: string) => farm?.sheds.find((s) => s.id === id)?.name ?? "";
  const mortMale = slip.shedRows.reduce((n, r) => n + r.mortMale, 0);
  const mortFemale = slip.shedRows.reduce((n, r) => n + r.mortFemale, 0);
  let n = 0;
  return (
    <>
      <table>
        <thead>
          <tr>
            <H id="line.srNo" />
            <H id="line.nameOfItem" />
            <H id="line.quantity" right />
            <H id="line.ledgerFolio" />
            <H id="line.purpose" />
          </tr>
        </thead>
        <tbody>
          {slip.shedRows.map((r) => (
            <tr key={r.shedId}>
              <td className="num">{++n}</td>
              <td>
                {items.get(r.feedItemId)?.name} — {shedName(r.shedId)}
              </td>
              <td className="num text-right">{fmtQty(r.feedKg)} KG</td>
              <td className="num">{items.get(r.feedItemId)?.number}</td>
              <td className="num">
                <Bi id="sis.mortMale" inline /> {r.mortMale} · <Bi id="sis.mortFemale" inline /> {r.mortFemale}
              </td>
            </tr>
          ))}
          {slip.lines.map((l, i) => {
            const item = items.get(l.itemId);
            return (
              <tr key={i}>
                <td className="num">{++n}</td>
                <td>
                  <ItemName item={item} />
                </td>
                <td className="num text-right">
                  {fmtQty(l.qty)} {unitOf(item)}
                </td>
                <td className="num">{item?.number}</td>
                <td dir="auto">
                  {l.purpose}
                  {l.shedId && <span className="ml-1">({shedName(l.shedId)})</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {slip.shedRows.length > 0 && (
        <p className="num mt-2 font-semibold">
          <Bi id="sis.total" inline />: {fmtQty(slip.shedRows.reduce((s, r) => s + r.feedKg, 0))} KG ·{" "}
          <Bi id="sis.mortMale" inline /> {mortMale} · <Bi id="sis.mortFemale" inline /> {mortFemale}
        </p>
      )}
    </>
  );
}
