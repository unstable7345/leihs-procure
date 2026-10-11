import React, { Fragment as F, useEffect, useState } from 'react'
import f from 'lodash'
import cx from 'classnames'
import gql from 'graphql-tag'

import { useLocation } from 'react-router-dom'
import { useMutation, useQuery } from '@apollo/client'

// import * as CONSTANTS from '../constants'
import * as Fragments from '../graphql-fragments'
import t from '../locale/translate'
import { useSearchParams, useNavigate } from 'react-router-dom'
import Icon from '../components/Icons'
import {
  Row,
  Col,
  Button,
  Badge,
  Collapsing,
  FormGroup,
  Select,
  StatefulForm
} from '../components/Bootstrap'

import { FormGroup as FormGroupStrap, Input, Label } from 'reactstrap/lib'

import { MainWithSidebar } from '../components/Layout'
import Loading from '../components/Loading'
import { ErrorPanel } from '../components/Error'
import {
  DisplayName,
  formatCurrency,
  budgetPeriodDates
} from '../components/decorators'
import ImageThumbnail from '../components/ImageThumbnail'

import RequestForm from '../components/RequestForm'
import { requestDataFromFields as requestDataFromFieldsBase } from '../containers/RequestEdit'
import CurrentUser from '../containers/CurrentUserProvider'

const NEW_REQUEST_PRESELECTION_QUERY = gql`
  query newRequestPreselectionQuery {
    budget_periods {
      id
      name
      inspection_start_date
      end_date
    }
    main_categories {
      id
      name
      image_url
      categories {
        id
        name
      }
    }
    templates {
      id
      category {
        id
      }
      is_archived
      article_name
      article_number
      model {
        id
        product
        version
      }
      price_cents
      price_currency
      supplier {
        id
      }
    }
  }
`

const NEW_REQUEST_QUERY = gql`
  query newRequestQuery($budgetPeriod: ID!, $category: ID, $template: ID) {
    new_request(
      budget_period: $budgetPeriod
      category: $category
      template: $template
    ) {
      ...RequestFieldsForEdit
    }
  }
  ${Fragments.RequestFieldsForEdit}
`

const CREATE_REQUEST_MUTATION = gql`
  mutation createRequest($requestData: CreateRequestInput) {
    create_request(input_data: $requestData) {
      id # NOTE: only redirecting, so just id is needed
    }
  }
`

const requestDataFromFields = (request, fields, preselection) => ({
  ...requestDataFromFieldsBase(request, fields),
  // only for create:
  budget_period: preselection.budgetPeriod,
  category: preselection.category,
  template: preselection.template
})

function RequestNewPage() {
  const [selectedParams, setSelectedParams] = useState({})

  const [searchParams, setSearchParams] = useSearchParams()
  const { loading, error, data } = useQuery(NEW_REQUEST_PRESELECTION_QUERY)

  const location = useLocation()

  useEffect(() => {
    // Convert 'searchParams' to an array of key-value pairs and then to an object.
    const selection = Array.from(searchParams)
      .map(([key, value]) => {
        return {
          [key]: value
        }
      })
      .reduce((acc, obj) => {
        return { ...acc, ...obj }
      }, {})

    // Update the 'selectedParams' state with the newly created selection object.
    setSelectedParams(selection)
  }, [searchParams])

  const handleSetQueryParams = fields => {
    const params = {
      ...(fields.budgetPeriod ? { budgetPeriod: fields.budgetPeriod } : {}),
      ...(fields.mainCategory ? { mainCategory: fields.mainCategory } : {}),
      ...(fields.category ? { category: fields.category } : {}),
      ...(fields.template ? { template: fields.template } : {})
    }

    setSearchParams(params)
  }

  if (loading) return <Loading />
  if (error) return <ErrorPanel error={error} data={data} />

  return (
    <CurrentUser>
      {me => (
        <MainWithSidebar>
          <h1>{t('request_new.title')}</h1>

          <NewRequestPreselection
            key={location.key} // reset state on location change!
            me={me}
            data={data}
            selection={selectedParams}
            onChange={fields => {
              handleSetQueryParams(fields)
            }}
          />
        </MainWithSidebar>
      )}
    </CurrentUser>
  )
}

export default RequestNewPage

class NewRequestPreselection extends React.Component {
  render({ props: { me, data, selection, onChange, formKey } } = this) {
    const budgetPeriods = f.map(data.budget_periods, bp => ({
      ...bp,
      ...budgetPeriodDates(bp)
    }))

    const CatWithMainCat = catId => {
      const mc = data.main_categories.reduce((acc, mainCategory) => {
        const category = mainCategory.categories.find(el => el.id === catId)
        if (category !== undefined) return category
        return acc
      }, null)

      const sc = f.find(mc.categories, { id: catId })
      return { ...sc, main_category: { ...mc, categories: undefined } }
    }

    return (
      <StatefulForm
        idPrefix={`request_new`}
        values={selection}
        key={JSON.stringify(selection)}
      >
        {({ fields, setValue, setValues, ...formHelpers }) => {
          const selectedBudgetPeriod = f.find(budgetPeriods, {
            id: fields.budgetPeriod
          })

          const selectedCategory = fields.category
          const selectedMainCat = f.find(data.main_categories, {
            id: fields.mainCategory
          })
          const selectedTemplate = f.find(data.templates, {
            id: fields.template
          })

          const hasPreselected = !!(
            selectedBudgetPeriod &&
            (selectedTemplate || selectedCategory)
          )

          const setSelection = selection => {
            onChange({ ...fields, ...selection })
          }

          const formPropsFor = name => ({
            ...formHelpers.formPropsFor(name),
            onChange: e => setSelection({ [name]: e.target.value })
          })

          const resetTemplate = () => {
            if (!selectedTemplate) return setSelection()
            setSelection({
              template: null,
              category: selectedTemplate.category.id
            })
          }

          const shownBudgetPeriods = onlyAllowedBudgetPeriods(
            me,
            budgetPeriods
          ).map(bp => {
            const labelPost = bp.isInspecting
              ? `${t('request_new.inspecting_until')} ${fmtDate(bp.end_date)}`
              : `${t('request_new.requesting_until')} ${fmtDate(bp.inspection_start_date)}`
            return {
              value: bp.id,
              label: `${bp.name} – ${labelPost}`
            }
          })

          // NOTE: if a MC is selected in params, show only it's subcats
          const shownMainCats = f.filter(
            onlyAllowedCategories(
              me,
              selectedBudgetPeriod,
              data.main_categories
            ),
            !selectedMainCat ? {} : { id: selectedMainCat.id }
          )

          const categoryTree = shownMainCats.map(mc => ({
            ...mc,
            categories: mc.categories.map(sc => ({
              ...sc,
              templates: f.filter(data.templates, { category: { id: sc.id } })
            }))
          }))

          // only show validations in error case (only red no green)
          const showValidations = !selectedBudgetPeriod

          return (
            <F>
              <form className={cx({ 'was-validated': showValidations })}>
                <FormGroupStrap>
                  <Label for="budgetPeriodSelect">{t('request_new.budget_period')}</Label>
                  <Input
                    required
                    id="budgetPeriodSelect"
                    name="select"
                    type="select"
                    defaultValue={fields.budgetPeriod}
                    onChange={e =>
                      setSelection({ budgetPeriod: e.target.value })
                    }
                  >
                    <option value="">{t('request_new.please_choose')}</option>
                    {shownBudgetPeriods.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Input>
                </FormGroupStrap>
                {/* <FormGroup>
                  <Select
                    {...formPropsFor('budgetPeriod')}
                    className="custom-select-lg"
                    required
                    options={shownBudgetPeriods}
                  />
                </FormGroup> */}
                {selectedBudgetPeriod && (
                  <FormGroup
                    label={t('request_new.category_and_template')}
                    className="form-group-lg"
                  >
                    <Row cls="mb-3">
                      <Let
                        tpl={selectedTemplate}
                        mc={selectedMainCat}
                        cat={
                          selectedCategory
                            ? CatWithMainCat(selectedCategory)
                            : selectedTemplate
                            ? CatWithMainCat(selectedTemplate.category.id)
                            : null
                        }
                      >
                        {({ mc, cat, tpl }) => (
                          <F>
                            <Col sm>
                              {!!(mc || cat) && (
                                <SelectionCard
                                  onRemoveClick={() =>
                                    setSelection({ category: null })
                                  }
                                >
                                  <Icon.Categories spaced="2" />
                                  {mc ? (
                                    mc.name
                                  ) : (
                                    <F>
                                      {cat.main_category.name}
                                      <Icon.CaretRight />
                                      {cat.name}
                                    </F>
                                  )}
                                </SelectionCard>
                              )}
                            </Col>

                            <Col sm>
                              {hasPreselected &&
                                (!tpl ? (
                                  <SelectionCard>{t('request_new.no_template')}</SelectionCard>
                                ) : (
                                  <SelectionCard onRemoveClick={resetTemplate}>
                                    <Icon.Templates spaced />
                                    {tpl.article_name || DisplayName(tpl.model)}
                                  </SelectionCard>
                                ))}
                            </Col>
                          </F>
                        )}
                      </Let>
                    </Row>

                    {!hasPreselected && (
                      <Let
                        onSelectCategory={c => setSelection({ category: c.id })}
                        onSelectTemplate={t => setSelection({ template: t.id })}
                      >
                        {({ onSelectCategory, onSelectTemplate }) =>
                          selectedMainCat ? (
                            <div className="card">
                              <CategoryItemsList
                                items={categoryTree[0].categories}
                                onSelectCategory={onSelectCategory}
                                onSelectTemplate={onSelectTemplate}
                              />
                            </div>
                          ) : (
                            <CategoriesTemplatesTree
                              mainCategories={categoryTree}
                              onSelectCategory={onSelectCategory}
                              onSelectTemplate={onSelectTemplate}
                              onSelectMaincat={m =>
                                setSelection({ mainCategory: m.id })
                              }
                            />
                          )
                        }
                      </Let>
                    )}
                  </FormGroup>
                )}
              </form>
              {window.isDebug && <pre>{JSON.stringify(fields, 0, 2)}</pre>}

              {hasPreselected && (
                <NewRequestForm
                  budgetPeriod={fields.budgetPeriod}
                  category={fields.category}
                  template={fields.template}
                  onCancel={() => setSelection()}
                />
              )}
            </F>
          )
        }}
      </StatefulForm>
    )
  }
}

function NewRequestForm({ budgetPeriod, template, category, onCancel }) {
  const navigate = useNavigate()
  const { data, loading, error } = useQuery(NEW_REQUEST_QUERY, {
    variables: { budgetPeriod, template, category },
    fetchPolicy: 'network-only'
  })

  const [saveForm, mutation] = useMutation(CREATE_REQUEST_MUTATION, {
    onCompleted: data => {
      navigate(`/requests/${data.create_request.id}`, {
        state: {
          flash: {
            level: 'success',
            message: t('request_new.success')
          }
        }
      })
    }
  })

  if (loading) return <Loading />
  if (error) return <ErrorPanel error={error} data={data} />

  const request = data.new_request

  if (mutation.loading) return <Loading />
  if (mutation.error)
    return <ErrorPanel error={mutation.error} data={mutation.data} />
  return (
    <F>
      <hr className="my-4" />
      <RequestForm
        compactView
        id="new_request"
        request={request}
        categories={data.main_categories}
        budgetPeriods={data.budgetPeriods}
        onCancel={onCancel}
        onSubmit={fields =>
          saveForm({
            variables: {
              requestData: requestDataFromFields(request, fields, {
                budgetPeriod,
                template,
                category
              })
            }
          })
        }
      />
      {window.isDebug && <pre>{JSON.stringify({ request }, 0, 2)}</pre>}
    </F>
  )
}

const CategoriesTemplatesTree = ({
  mainCategories,
  onSelectCategory,
  onSelectMaincat,
  onSelectTemplate
}) => {
  return (
    <F>
      <ul className="list-unstyled">
        {mainCategories.map(mc => (
          <F key={mc.id}>
            <Collapsing
              id={'mc' + mc.id}
              canToggle={true}
              startOpen={mainCategories.length === 1}
            >
              {({
                isOpen,
                canToggle,
                toggleOpen,
                togglerProps,
                collapsedProps,
                Caret
              }) => (
                <li className="card mb-3">
                  <h3
                    className={cx('card-header h4 cursor-pointer', {
                      'border-bottom-0': !isOpen
                    })}
                    {...togglerProps}
                  >
                    <Caret spaced />
                    {!!mc.image_url && (
                      <ImageThumbnail
                        className="border-0 bg-transparent"
                        imageUrl={mc.image_url}
                      />
                    )}
                    {mc.name}
                  </h3>
                  {isOpen && (
                    <CategoryItemsList
                      items={mc.categories}
                      onSelectCategory={onSelectCategory}
                      onSelectTemplate={onSelectTemplate}
                    />
                  )}
                </li>
              )}
            </Collapsing>
          </F>
        ))}
      </ul>
    </F>
  )
}

const CategoryItemsList = ({ items, onSelectCategory, onSelectTemplate }) => {
  const hasAnyTemplates = f.any(f.map(items, 'templates'), l => !f.isEmpty(l))

  return (
    <ul className="list-group list-group-flush">
      {items.map(sc => (
        <F key={sc.id}>
          <li className="card list-group-item p-0">
            {!hasAnyTemplates ? (
              <AddButtonLine onClick={e => onSelectCategory(sc)}>
                {sc.name}
              </AddButtonLine>
            ) : (
              <F>
                <h4 className="card-header h5">{sc.name}</h4>

                <div className="list-group list-group-flush">
                  {sc.templates.map(t => (
                    <F key={t.id}>
                      {!t.is_archived && (
                        <AddButtonLine
                          t={t}
                          onClick={e => {
                            e.preventDefault()
                            onSelectTemplate(t)
                          }}
                        >
                          <Icon.Templates /> {t.article_name}{' '}
                          <Badge secondary>
                            <samp>{formatCurrency(t.price_cents)}</samp>
                          </Badge>
                        </AddButtonLine>
                      )}
                    </F>
                  ))}

                  <AddButtonLine onClick={e => onSelectCategory(sc)}>
                    {t('request_new.create_without_template')}
                  </AddButtonLine>
                </div>
              </F>
            )}
          </li>
        </F>
      ))}
    </ul>
  )
}

const SelectionCard = ({ children, onRemoveClick }) => (
  <div className="card">
    <div className="card-body px-3 py-2 d-flex justify-content-between align-items-center">
      <div>{children}</div>
      {!!onRemoveClick && (
        <Button color="link" outline size="sm" onClick={e => onRemoveClick()}>
          <Icon.Cross />
        </Button>
      )}
    </div>
  </div>
)

const AddButtonLine = ({ children, ...props }) => (
  <button
    type="button"
    className="list-group-item list-group-item-action cursor-pointer"
    {...props}
  >
    <Icon.PlusCircle color="success" className="mr-3" size="lg" />
    {children}
  </button>
)

const Let = ({ children, ...props }) => children(props)

const onlyAllowedBudgetPeriods = (me, bps) =>
  bps.filter(bp => {
    const d = budgetPeriodDates(bp)
    return (
      (d.isRequesting && me.roles.isRequester) ||
      (d.isInspecting && (me.roles.isAdmin || me.roles.isInspector))
    )
  })

const onlyAllowedCategories = (me, selectedBudgetPeriod, allCats) => {
  const inspected = f.map(me.user.permissions.isInspectorForCategories, 'id')
  if (!selectedBudgetPeriod) return null
  if (selectedBudgetPeriod.isRequesting) return allCats
  if (me.roles.isAdmin) return allCats
  if (selectedBudgetPeriod.isInspecting)
    return allCats
      .map(mc => ({
        ...mc,
        categories: mc.categories.filter(sc => f.includes(inspected, sc.id))
      }))
      .filter(mc => mc.categories.length > 0)
}

const fmtDate = d => new Date(d).toLocaleDateString()
