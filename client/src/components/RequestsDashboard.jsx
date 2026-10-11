import React, { Fragment as F, Suspense } from 'react'
import cx from 'classnames'
import f from 'lodash'
import { Link } from 'react-router-dom'
import { stringify as stringifyQuery } from 'qs'

import t from '../locale/translate'
import {
  Row,
  Col,
  Button,
  ButtonToolbar,
  UncontrolledDropdown as Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  Collapsing,
  Tooltipped
} from './Bootstrap'
import { formatCurrency, budgetPeriodDates } from './decorators'
import { MainWithSidebar } from './Layout'
import Icon from './Icons'
import Loading from './Loading'
import { ErrorPanel } from './Error'
import RequestLine from './RequestLine'
import ImageThumbnail from './ImageThumbnail'
import DataTable from '../components/DataTable'

import CurrentUser from '../containers/CurrentUserProvider'
import FilterBar, { BIG as filterBarBreakPoint } from './RequestsFilterBar'
import logger from 'debug'
const log = logger('app:ui:RequestsDashboard')

const SpreadsheetExportProvider = React.lazy(() =>
  import('./SpreadsheetExportProvider')
)

class RequestsDashboard extends React.Component {
  state = { exportView: false, showFilter: true }

  render({ props, state } = this) {
    log('render', { props })
    const { requestsQuery, refetchAllData, refetchQuery } = props

    const isLoading = !!(requestsQuery.loading && !requestsQuery.data)

    const requestTotalCount =
      f.get(requestsQuery, 'data.dashboard.total_count') || 0

    const pageHeader = (
      <Row cls="pt-1">
        <Col sm>
          <h1 className="h4">
            {requestsQuery.loading
              ? t('dashboard.requests_title_loading')
              : `${requestTotalCount} ${
                  requestTotalCount === 1
                    ? t('dashboard.requests_title_singular')
                    : t('dashboard.requests_title_plural')
                }${state.exportView ? ' exportieren' : ''}`}
          </h1>
        </Col>
        <Col sm cls="d-flex justify-content-end align-items-end">
          <ButtonToolbar size="sm" className="mb-2">
            <Button
              size="sm"
              outline
              cls={cx('mr-1 mb-1', {
                // NOTE: hide on smaller size, but not if currently hiding filters!
                [`d-none d-${filterBarBreakPoint}-inline`]: state.showFilter
              })}
              active={state.showFilter}
              onClick={e => this.setState(s => ({ showFilter: !s.showFilter }))}
            >
              {'Filter'}
            </Button>

            <Button
              size="sm"
              cls="mr-1 mb-1"
              outline
              active={state.exportView}
              onClick={e => this.setState(s => ({ exportView: !s.exportView }))}
            >
              <Icon.Table /> {'Export'}
            </Button>

            <Button
              size="sm"
              cls="mr-1 mb-1"
              outline
              title={t('dashboard.refresh_data')}
              onClick={refetchAllData}
            >
              <Icon.Reload spin={requestsQuery.loading} />
            </Button>
          </ButtonToolbar>
        </Col>
      </Row>
    )

    const SpreadsheetExporter = state.exportView && !isLoading && (
      <Suspense fallback={<Loading size="1" />}>
        <SpreadsheetExportProvider requestsData={requestsQuery.data}>
          {({ table, download, exportFormats }) => (
            <div>
              <ButtonToolbar className="pb-3">
                {/* <ButtonToolbar className="row pb-3"> */}
                {/* <ButtonGroup className="col-auto mr-auto pt-3"> */}
                <Dropdown className="mr-2">
                  <DropdownToggle caret color="success">
                    <Icon.FileDownload spaced /> {'Herunterladen'}
                  </DropdownToggle>
                  <DropdownMenu>
                    {exportFormats.map(fmt => (
                      <DropdownItem
                        key={fmt.ext}
                        onClick={e => download(table, fmt)}
                      >
                        {fmt.name}
                      </DropdownItem>
                    ))}
                  </DropdownMenu>
                </Dropdown>

                <Button
                  outline
                  onClick={e => this.setState(s => ({ exportView: false }))}
                >
                  {t('dashboard.close_export_view')}
                </Button>
                {/* </ButtonGroup> */}
                {/* <ButtonGroup className="col-auto ml-auto pt-3">
                </ButtonGroup> */}
              </ButtonToolbar>

              <h2 className="h5">{t('dashboard.export_preview')}</h2>
              {<RequestTable table={table} query={requestsQuery} />}
            </div>
          )}
        </SpreadsheetExportProvider>
      </Suspense>
    )

    const [Wrapper, wrapProps] = !state.showFilter
      ? ['div', { className: 'pt-3 px-3' }]
      : [
          MainWithSidebar,
          {
            sidebar: (
              <FilterBar
                filters={props.filters}
                currentFilters={props.currentFilters}
                onFilterChange={props.onFilterChange}
              />
            )
          }
        ]

    return (
      <CurrentUser>
        {me => (
          <Wrapper {...wrapProps}>
            {pageHeader}

            {SpreadsheetExporter}

            {!state.exportView && (
              <RequestsTree
                requestsQuery={requestsQuery}
                me={me}
                refetchAllData={refetchAllData}
                refetchQuery={refetchQuery}
                openPanels={props.openPanels}
                onPanelToggle={props.onPanelToggle}
                doChangeRequestCategory={props.doChangeRequestCategory}
                doChangeBudgetPeriod={props.doChangeBudgetPeriod}
                doDeleteRequest={props.doDeleteRequest}
                editQuery={props.editQuery} //tmp?
                filters={props.currentFilters} // tmp
              />
            )}
          </Wrapper>
        )}
      </CurrentUser>
    )
  }
}
export default RequestsDashboard

const RequestsTree = ({
  requestsQuery: { loading, error, data, networkStatus },
  me,
  editQuery,
  filters,
  refetchAllData,
  refetchQuery,
  openPanels,
  onPanelToggle,
  doChangeRequestCategory,
  doChangeBudgetPeriod,
  doDeleteRequest
}) => {
  if (loading && !data) return <Loading size="1" />
  if (error) return <ErrorPanel error={error} data={data} />

  return f.map(f.get(data, 'dashboard.budget_periods'), b => (
    <BudgetPeriodCard key={b.id} budgetPeriod={b} me={me}>
      {f.map(b.main_categories, cat => {
        const subCatReqs = f.flatMap(f.get(cat, 'categories'), 'requests')
        if (filters.onlyCategoriesWithRequests && f.isEmpty(subCatReqs)) {
          return false
        }

        return (
          <CategoryLine
            key={cat.id}
            me={me}
            budgetPeriod={b}
            category={cat}
            requestCount={subCatReqs.length}
            isOpen={openPanels.cats.includes(cat.id)}
            onToggle={isOpen => onPanelToggle(isOpen, cat.id)}
          >
            {f.map(cat.categories, sc => {
              const reqs = sc.requests
              if (filters.onlyCategoriesWithRequests && f.isEmpty(reqs)) {
                return false
              }
              return (
                <SubCategoryLine
                  key={sc.id}
                  category={sc}
                  me={me}
                  budgetPeriod={b}
                  requestCount={reqs.length}
                  isOpen={openPanels.cats.includes(sc.id)}
                  onToggle={isOpen => onPanelToggle(isOpen, sc.id)}
                >
                  {f.map(reqs, (r, i) => (
                    <F key={r.id}>
                      <div
                        className={cx({
                          'border-bottom': i + 1 < reqs.length // not if last
                        })}
                      >
                        <RequestLine
                          request={r}
                          compactEditForm
                          editQuery={editQuery}
                          refetchQuery={refetchQuery}
                          doChangeRequestCategory={doChangeRequestCategory}
                          doChangeBudgetPeriod={doChangeBudgetPeriod}
                          doDeleteRequest={doDeleteRequest}
                        />
                      </div>
                    </F>
                  ))}
                </SubCategoryLine>
              )
            })}
          </CategoryLine>
        )
      })}
    </BudgetPeriodCard>
  ))
}

const BudgetPeriodCard = ({ budgetPeriod, me, ...props }) => {
  const { inspectStartDate, endDate, isPast, isRequesting, isInspecting } =
    budgetPeriodDates(budgetPeriod)

  // requester role always needed.
  // additional admin or inspector role needed to create in inspection phase
  const canRequest =
    me.roles.isRequester &&
    (isRequesting ||
      (isInspecting && (me.roles.isAdmin || me.roles.isInspector)))
  const newRequestBpLink = canRequest && newRequestLink({ budgetPeriod })

  const children = f.some(props.children) ? props.children : false

  return (
    <Collapsing id={`bp_${budgetPeriod.id}`} startOpen>
      {({ isOpen, toggleOpen, togglerProps, collapsedProps, Caret }) => (
        <div className={cx('card mb-3')}>
          <div
            className={cx('card-header cursor-pointer pl-2', {
              'border-bottom-0': !(isOpen && children),
              'bg-transparent': !isPast,
              'text-muted': isPast
            })}
            {...togglerProps}
          >
            <Row>
              <Col sm="8">
                <h1 className="mb-0 h4 d-inline-block">
                  <Caret spaced />
                  {budgetPeriod.name}
                </h1>

                <div className="d-inline-flex flex-wrap ml-3 mt-2">
                  <Tooltipped text={t('dashboard.requesting_phase_until')}>
                    <span
                      id={`inspectStartDate_tt_${budgetPeriod.id}`}
                      className={cx('mr-3', { 'text-success': isRequesting })}
                    >
                      <Icon.RequestingPhase className="mr-2" />
                      {inspectStartDate.toLocaleString()}
                    </span>
                  </Tooltipped>

                  <Tooltipped text={t('dashboard.inspection_phase_until')}>
                    <span
                      id={`endDate_tt_${budgetPeriod.id}`}
                      className={cx('mr-3', { 'text-success': isInspecting })}
                    >
                      <Icon.InspectionPhase className="mr-2" />
                      {endDate.toLocaleString()}
                    </span>
                  </Tooltipped>
                </div>
              </Col>

              <Col
                sm="3"
                className="col-10 align-self-center order-last order-sm-12 text-right"
              >
                {!!budgetPeriod.total_price_cents && (
                  <Tooltipped text={t('dashboard.bp_total_sum')}>
                    <span
                      className="mr-2 f6"
                      id={`ordqb_tt_${budgetPeriod.id}`}
                    >
                      <samp>
                        {formatCurrency(budgetPeriod.total_price_cents)}{' '}
                      </samp>
                      <Icon.ShoppingCart />
                    </span>
                  </Tooltipped>
                )}
              </Col>

              <Col
                sm="1"
                className="col-2 mt-2 mt-sm-0 order-sm-last text-right"
              >
                {newRequestBpLink && (
                  <Link to={newRequestBpLink}>
                    <Tooltipped text={t('dashboard.create_request_for_bp')}>
                      <Icon.PlusCircle
                        id={`tt_bp_cnr_${budgetPeriod.id}`}
                        size="2x"
                        color="success"
                      />
                    </Tooltipped>
                  </Link>
                )}
              </Col>
            </Row>
          </div>

          {isOpen && children && (
            <ul
              className="list-group list-group-flush bp-cat-list"
              {...collapsedProps}
            >
              {children}
            </ul>
          )}
        </div>
      )}
    </Collapsing>
  )
}

const CategoryLine = ({
  me,
  budgetPeriod,
  category,
  requestCount,
  canToggle,
  isOpen,
  onToggle,
  ...props
}) => (
  <Collapsing
    id={'bp' + category.id}
    canToggle={canToggle}
    startOpen={isOpen}
    onChange={({ isOpen }) => onToggle(isOpen)}
  >
    {({
      isOpen,
      canToggle,
      toggleOpen,
      togglerProps,
      collapsedProps,
      Caret
    }) => (
      <F>
        <li
          className={cx('list-group-item py-1', {
            disabled: !canToggle,
            'cursor-pointer': canToggle
          })}
          {...togglerProps}
        >
          <Row>
            <Col sm="8">
              <h2 className="h6 mb-0 mr-sm-3 d-inline-block">
                <Caret spaced />
                <ImageThumbnail size={2.75} imageUrl={category.image_url} />
                {category.name} <small>({requestCount})</small>
              </h2>
            </Col>

            <Col
              sm="3"
              className="col-10 align-self-center order-last order-sm-12 text-right"
            >
              {!!category.total_price_cents && (
                <Tooltipped text={t('dashboard.maincat_total_sum')}>
                  <small className="mr-2 f6" id={`ordqmc_tt_${category.id}`}>
                    <samp>{formatCurrency(category.total_price_cents)} </samp>
                    <Icon.ShoppingCart />
                  </small>
                </Tooltipped>
              )}
            </Col>

            <Col sm="1" className="col-2 mt-2 mt-sm-0 order-sm-last text-right">
              {/* TODO: decide if/how to show these links
              {canRequest && (
                <Link
                  to={newRequestLink({ budgetPeriod, mainCategory: category })}
                >
                  <Tooltipped text={t('dashboard.create_request_for_maincat')}>
                    <Icon.PlusCircle
                      id={`tt_mc_cnr_${category.id}`}
                      size="2x"
                      color="success"
                    />
                  </Tooltipped>
                </Link>
              )} */}
            </Col>
          </Row>
        </li>
        {isOpen && props.children && (
          <li className="list-group-item p-0" {...collapsedProps}>
            <ul className="list-group list-group-flush">{props.children}</ul>
          </li>
        )}
      </F>
    )}
  </Collapsing>
)

const SubCategoryLine = ({
  category,
  me,
  budgetPeriod,
  requestCount,
  isOpen,
  onToggle,
  ...props
}) => {
  const showChildren = (isOpen, children) =>
    !!isOpen && React.Children.count(children) > 0

  return (
    <Collapsing
      id={'bp' + category.id}
      canToggle={isOpen || requestCount > 0}
      startOpen={isOpen}
      onChange={({ isOpen }) => onToggle(isOpen)}
    >
      {({
        isOpen,
        canToggle,
        toggleOpen,
        togglerProps,
        collapsedProps,
        Caret
      }) => (
        <F>
          <li
            className={cx('list-group-item', {
              disabled: !canToggle,
              'cursor-pointer': canToggle
            })}
            {...togglerProps}
          >
            <Row>
              <Col sm="8">
                <h3 className="h6 mb-0 mr-sm-3 d-inline-block">
                  <Caret spaced />
                  {category.name} <span>({requestCount})</span>
                </h3>
              </Col>
              <Col
                sm="3"
                className="col-10 align-self-center order-last order-sm-12 text-right"
              >
                {!!category.total_price_cents && (
                  <Tooltipped text={t('dashboard.subcat_total_sum')}>
                    <small className="mr-2 f6" id={`ordqsc_tt_${category.id}`}>
                      <samp>{formatCurrency(category.total_price_cents)} </samp>
                      <Icon.ShoppingCart />
                    </small>
                  </Tooltipped>
                )}
              </Col>
              <Col
                sm="1"
                className="col-2 mt-2 mt-sm-0 order-sm-last text-right"
              >
                {/* TODO: decide if/how to show these links
                {canRequest && (
                  <Link to={newRequestLink({ budgetPeriod, category })}>
                    <Tooltipped text={t('dashboard.create_request_for_subcat')}>
                      <Icon.PlusCircle
                        id={`tt_sc_cnr_${category.id}`}
                        size="2x"
                        color="success"
                      />
                    </Tooltipped>
                  </Link>
                )} */}
              </Col>
            </Row>
          </li>
          {showChildren(isOpen, props.children) && (
            <li
              className="list-group-item p-0 ui-subcat-items"
              {...collapsedProps}
            >
              {props.children}
            </li>
          )}
        </F>
      )}
    </Collapsing>
  )
}

const RequestTable = ({
  table,
  query: { loading, error, data, networkStatus }
}) => {
  if (loading && !data) return <Loading size="1" />
  if (error) return <ErrorPanel error={error} data={data} />
  if (!table.rows.length) return '---'
  return <DataTable small darkHead bordered striped hover {...table} />
}

const newRequestLink = ({
  budgetPeriod = {},
  mainCategory = {},
  category = {}
}) => ({
  pathname: '/requests/new',
  search:
    '?' +
    stringifyQuery({
      budgetPeriod: budgetPeriod.id,
      mainCategory: mainCategory.id,
      category: category.id
    })
})
