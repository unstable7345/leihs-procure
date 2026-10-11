import React from 'react'
import f from 'lodash'
import { writeFile, utils } from 'xlsx'
import t from '../locale/translate'
import {
  DisplayName,
  RequestTotalAmount,
  RequestFieldValue
} from '../components/decorators'

const EXPORT_FORMATS = [
  { type: 'xlsx', ext: 'xlsx', name: '.xlsx (Excel 2007+)' },
  { type: 'biff8', ext: 'xls', name: '.xls (Excel 97-2004)' },
  { type: 'ods', ext: 'ods', name: '.ods (LibreOffice, …)' },
  { type: 'csv', ext: 'csv', name: '.csv' }
]

class SpreadsheetExporter extends React.Component {
  render({ requestsData, children } = this.props) {
    const table = convertToTablularData(requestsData)
    return children({
      table,
      download: exportAndDownloadSpreadsheet,
      exportFormats: EXPORT_FORMATS
    })
  }
}

export default SpreadsheetExporter

function exportAndDownloadSpreadsheet(table, { type, ext }, title) {
  const calendarDate = new Date().toISOString().split('T')[0]
  const rows = [table.headers, ...table.rows]
  const workSheet = utils.aoa_to_sheet(rows)
  const workBook = utils.book_new()
  utils.book_append_sheet(workBook, workSheet, title || t('app_title'))
  writeFile(workBook, `procure_${calendarDate}.${ext}`)
}

// NOTE: conversion of dashboard data here
const REQ_NUM_PREFIX = '#' // prevent Excel from auto-converting this field (into a Date or Floating Point Number depending on locale)
const spreadSheetCols = [
  {
    key: 'short_id',
    label: t('export.short_id'),
    fn: (r) => REQ_NUM_PREFIX + f.get(r, 'short_id')
  },
  {
    key: 'budget_period',
    label: t('export.budget_period'),
    fn: (r) => f.get(r, 'budget_period.value.name')
  },
  {
    key: 'main_category',
    label: t('export.main_category'),
    fn: (r) => f.get(r, 'category.value.main_category.name')
  },
  {
    key: 'category',
    label: t('export.subcategory'),
    fn: (r) => f.get(r, 'category.value.name')
  },
  { key: 'user', label: t('export.user') },
  {
    key: 'department',
    label: t('export.department'),
    fn: (r) => f.get(r, 'organization.value.department.name')
  },
  {
    key: 'organization',
    label: t('export.organization'),
    fn: (r) => f.get(r, 'organization.value.name')
  },
  { key: 'article_name', label: t('export.article_name') },
  {
    key: 'article_number',
    label: t('export.article_number')
  },
  {
    key: 'supplier',
    label: t('export.supplier'),
    fn: (r) => f.get(r, 'supplier.value.id') || f.get(r, 'supplier_name.value')
  },
  { key: 'requested_quantity', label: t('export.requested_quantity') },
  { key: 'approved_quantity', label: t('export.approved_quantity') },
  { key: 'order_quantity', label: t('export.order_quantity') },
  {
    key: 'price',
    label: t('export.price'),
    fn: (r) => (f.get(r, 'price_cents.value') || 0) / 100
  },
  {
    key: 'total_price',
    label: t('export.total_price'),
    fn: (r) => f.try((_) => (RequestTotalAmount(r) || 0) / 100)
  },
  {
    key: 'state',
    label: t('export.state'),
    fn: (r) => RequestFieldValue('state', r)
  },
  {
    key: 'priority',
    label: t('export.priority'),
    fn: (r) => f.try((_) => RequestFieldValue('priority', r))
  },
  {
    key: 'inspector_priority',
    label: t('export.inspector_priority'),

    fn: (r) => f.try((_) => RequestFieldValue('inspector_priority', r))
  },
  {
    key: 'Ersatz / Neu',
    label: t('export.replacement'),
    fn: (r) => f.try((_) => RequestFieldValue('replacement', r))
  },
  { key: 'receiver', label: t('export.receiver') },
  {
    key: 'building',
    label: t('export.building'),
    fn: (r) => f.get(r, 'room.value.building.name')
  },
  { key: 'room', label: t('export.room'), fn: (r) => f.get(r, 'room.value.name') },
  { key: 'motivation', label: t('export.motivation') },
  { key: 'inspection_comment', label: t('export.inspection_comment') },
  {
    key: 'accounting_type',
    label: t('request_form_field.accounting_type'),
    fn: (r) => RequestFieldValue('accounting_type', r)
  },
  { key: 'cost_center', label: t('export.cost_center') },
  { key: 'general_ledger_account', label: t('export.general_ledger_account') },
  { key: 'procurement_account', label: t('export.procurement_account') },
  { key: 'internal_order_number', label: t('export.internal_order_number') },
  { key: 'order_status', label: t('export.order_status') },
  { key: 'order_comment', label: t('export.order_comment') },
  {
    key: 'url',
    label: t('export.url'),
    fn: (r) => `https://leihs.example.com/procure/requests/${r.id}`
  }
]

function convertToTablularData(data) {
  const table = f.flatMap(f.get(data, 'dashboard.budget_periods'), (bp) =>
    f.flatMap(bp.main_categories, (mc) =>
      f.flatMap(mc.categories, (sc) =>
        f.map(sc.requests, (r) =>
          f.fromPairs(
            spreadSheetCols.map((col) => [col.key, getFieldValue(col, r)])
          )
        )
      )
    )
  )
  const cols = spreadSheetCols.map((c) => ({ key: c.key, name: c.label }))
  const headers = f.map(cols, 'name')
  const rows = f.map(table, (row) => f.map(cols, ({ key }) => row[key]))

  return { table, headers, cols, rows }
}

function getFieldValue(col, request) {
  if (col.fn) return col.fn(request)
  if (!f.has(request, col.key)) throw new Error(`missing field '${col.key}'!`)
  const val = f.get(request, [col.key, 'value'])
  return (
    ((f.isString(val) || f.isNumber(val)) && val) ||
    f.try(() => DisplayName(val)) ||
    ''
  )
}
