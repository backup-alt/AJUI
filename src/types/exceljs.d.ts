declare module "exceljs" {
  // Minimal ambient declarations so the application can import exceljs.
  // These intentionally cover only the surface area we use (workbook,
  // worksheet, cell styling, columns, rows, page setup, header/footer).
  // If more APIs are needed in the future, replace this file with
  // `@types/exceljs` or extend this declaration.

  export type Color = { argb?: string; theme?: number; tint?: number };
  export type PatternFill = {
    type: "pattern";
    pattern: "solid" | "none" | string;
    fgColor?: Color;
    bgColor?: Color;
  };
  export type BorderSide = { style?: string; color?: Color };
  export type Borders = {
    top?: BorderSide;
    left?: BorderSide;
    right?: BorderSide;
    bottom?: BorderSide;
    diagonal?: BorderSide;
  };
  export type Font = {
    name?: string;
    size?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean | string;
    color?: Color;
  };
  export type Alignment = {
    horizontal?: "left" | "center" | "right" | "fill" | "justify";
    vertical?: "top" | "middle" | "bottom";
    wrapText?: boolean;
    indent?: number;
  };
  export interface Cell {
    value: any;
    text: string;
    font?: Font;
    fill?: PatternFill;
    alignment?: Alignment;
    border?: Borders;
    numFmt?: string;
    indent?: number;
    merge(target: string | Cell, target2?: string | Cell): void;
    style: string;
  }
  export interface Column {
    width?: number;
    header?: string;
    values?: any[];
    letter?: string;
  }
  export interface Row {
    values: any[];
    height?: number;
    font?: Font;
    fill?: PatternFill;
    border?: Borders;
    alignment?: Alignment;
    numFmt?: string;
    eachCell(cb: (cell: Cell, rowNumber: number) => void): void;
    getCell(col: number): Cell;
  }
  export interface Worksheet {
    addRow(values: any[]): Row;
    getRow(row: number): Row;
    getCell(addr: string | number): Cell;
    getColumn(col: number | string): Column;
    mergeCells(range: string): void;
    unMergeCells(range: string): void;
    columns: Column[];
    rowCount: number;
    pageSetup: {
      paperSize?: number;
      orientation?: "portrait" | "landscape";
      fitToPage?: boolean;
      fitToWidth?: number;
      fitToHeight?: number;
      margins?: {
        left?: number;
        right?: number;
        top?: number;
        bottom?: number;
        header?: number;
        footer?: number;
      };
      horizontalCentered?: boolean;
      verticalCentered?: boolean;
    };
    headerFooter: {
      oddHeader?: string;
      oddFooter?: string;
    };
    views: Array<{
      state?: "normal" | "frozen" | "frozenSplit";
      showGridLines?: boolean;
      zoomScale?: number;
    }>;
    lastRow: { number: number };
  }
  export interface Workbook {
    creator: string;
    created: Date;
    modified: Date;
    addWorksheet(name: string, options?: { views?: any[] }): Worksheet;
    getWorksheet(nameOrIndex: string | number): Worksheet | undefined;
    worksheets: Worksheet[];
    addImage(): unknown;
    xlsx: {
      writeBuffer(): Promise<ArrayBuffer>;
      write(stream: NodeJS.WritableStream | { write: (chunk: any) => void }): Promise<void>;
      read(stream: NodeJS.ReadableStream | { read: (size: number) => any }): Promise<void>;
      load(buffer: ArrayBuffer | Buffer): void;
    };
  }
  export default class ExcelJS {
    static Workbook: typeof WorkbookClassRef;
    constructor();
    creator: string;
    created: Date;
    modified: Date;
    addWorksheet(name: string, options?: { views?: any[] }): Worksheet;
    xlsx: Workbook["xlsx"];
  }
  // Internal alias to satisfy the default-export shape.
  declare const WorkbookClassRef: { new (): Workbook };
}