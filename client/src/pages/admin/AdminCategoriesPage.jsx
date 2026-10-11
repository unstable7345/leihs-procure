import React, { Fragment as F, useState, useEffect } from 'react'
import cx from 'classnames'
import {
  Route,
  Routes,
  NavLink,
  useMatch,
  useNavigate,
  useParams
} from 'react-router-dom'
import f from 'lodash'
import { Query, Mutation } from '@apollo/client/react/components'
import gql from 'graphql-tag'
import t from '../../locale/translate'
import { mutationErrorHandler } from '../../apollo-client'
import Icon from '../../components/Icons'
import {
  Div,
  Row,
  Col,
  Button,
  StatefulForm,
  FormGroup,
  FormField,
  Tooltipped,
  InputFileUpload
} from '../../components/Bootstrap'
import { MainWithSidebar } from '../../components/Layout'
import { DisplayName } from '../../components/decorators'
import Loading from '../../components/Loading'
import { ErrorPanel } from '../../components/Error'
import UserAutocomplete from '../../components/UserAutocomplete'
import { useQuery } from '@apollo/client/react/hooks'

const CATEGORIES_INDEX_QUERY = gql`
  query MainCategoriesIndex {
    # for TableOfContents
    main_categories {
      id
      name
      image_url
      categories {
        id
        name
        can_delete
      }
    }
  }
`

const MAINCAT_PROPS_FRAGMENT = gql`
  fragment MainCatProps on MainCategory {
    id
    name
    can_delete
    image_url
    categories {
      id
      name
      can_delete
      cost_center
      general_ledger_account
      procurement_account
      inspectors {
        ...UserProps
      }
      viewers {
        ...UserProps
      }
    }
  }
  fragment UserProps on User {
    id
    firstname
    lastname
  }
`

// TODO: get single MainCat by id!
// Currently not too bad, rendering is more expensive than fetching,
// also due to caching it only fetches once anyhow!
const CATEGORIES_QUERY = gql`
  query MainCategories {
    main_categories {
      ...MainCatProps
    }
  }
  ${MAINCAT_PROPS_FRAGMENT}
`

const UPDATE_CATEGORIES_MUTATION = gql`
  mutation updateCategoriesPeriods($mainCategories: [MainCategoryInput]) {
    main_categories(input_data: $mainCategories) {
      ...MainCatProps
    }
  }
  ${MAINCAT_PROPS_FRAGMENT}
`

const updateCategories = {
  mutation: {
    mutation: UPDATE_CATEGORIES_MUTATION,
    onError: mutationErrorHandler,
    fetchPolicy: 'no-cache',

    update: (cache, { data: { main_categories } }) => {
      cache.writeQuery({ query: CATEGORIES_QUERY, data: { main_categories } })
    }
  },
  doUpdate: (mutate, mainCats) => {
    const data = mainCats.map(mainCat => {
      return {
        ...f.pick(mainCat, ['id', 'name', 'toDelete']),

        new_image_url: f.map(mainCat.new_image_url, o => ({
          ...f.pick(o, 'id', 'typename'),
          to_delete: !!o.toDelete
        })),
        categories: f
          .filter(mainCat.categories, mc => !mc.toDelete)
          .map(sc => ({
            ...f.pick(sc, [
              'id',
              'name',
              'procurement_account',
              'general_ledger_account',
              'cost_center'
            ]),
            inspectors: f
              .filter(sc.inspectors, u => !u.toDelete)
              .map(i => i.id),
            viewers: f.filter(sc.viewers, u => !u.toDelete).map(i => i.id)
          }))
      }
    })

    mutate({
      variables: { mainCategories: data }
    })
  },
  successFlash: 'OK!'
}

// # PAGE
//
const AdminCategoriesPage = () => {
  const match = useMatch('/admin/categories/*')

  return (
    <Query query={CATEGORIES_INDEX_QUERY}>
      {({ loading, error, data }) => {
        if (loading) return <Loading />
        if (error) return <ErrorPanel error={error} data={data} />

        const categoriesToc = data.main_categories
        const sidebar = (
          <>
            <SideNav categories={categoriesToc} baseUrl={match.pathnameBase} />
            <hr className="d-xl-none" />
          </>
        )

        return (
          <MainWithSidebar sidebar={sidebar}>
            <Routes>
              <Route
                path=":mainCatId"
                element={<CategoryPage />}
                render={route => <CategoryPage {...route} />}
              />
            </Routes>
            <>
              <TableOfContents
                withSubcats
                categories={categoriesToc}
                baseUrl={match.pathnameBase}
              />

              {/* preload rest of content */}
              <Query query={CATEGORIES_QUERY}>{() => false}</Query>
            </>
          </MainWithSidebar>
        )
      }}
    </Query>
  )
}

export default AdminCategoriesPage

// # VIEW PARTIALS
//

function CategoryPage(props) {
  const [formKey, setFormKey] = useState(Date.now())
  const navigate = useNavigate()
  const params = useParams()

  const query = useQuery(CATEGORIES_QUERY)
  if (query.loading) return <Loading />
  if (query.error) return <ErrorPanel error={query.error} data={query.data} />

  const categories = query.data.main_categories

  const mainCatId = f.enhyphenUUID(params.mainCatId)
  const isNew = mainCatId === 'new'

  const mainCat = isNew
    ? { name: '', categories: [] }
    : f.find(categories, {
      id: mainCatId
    })

  if (!mainCat) {
    navigate('/admin/categories')
  }

  return (
    <Mutation
      {...updateCategories.mutation}
      onCompleted={newData => {
        setFormKey({ formKey: Date.now() })
        window.scrollTo(0, 0)
        const successMessage = t('admin.categories.add_category_success')
        const newCategory = newData.main_categories.at(-1)
        const newCategoryID = newCategory.id.replace(/-/g, '')

        if (isNew) {
          navigate(`/admin/categories/${newCategoryID}`, {
            state: {
              flash: {
                level: 'success',
                message: successMessage
              }
            }
          })
        }
      }}
    >
      {(mutate, info) => (
        <CategoryCard
          {...mainCat}
          isNew={isNew}
          formKey={formKey}
          onSubmit={mainCat => updateCategories.doUpdate(mutate, [mainCat])}
          onDelete={mainCat => {
            const successMessage = t('admin.categories.delete_category_success')
            navigate(`/admin/categories/`, {
              state: {
                flash: {
                  level: 'success',
                  message: successMessage
                }
              }
            })
            updateCategories.doUpdate(mutate, [
              { id: mainCat.id, toDelete: true }
            ])
          }}
        />
      )}
    </Mutation>
  )
}

const extendWhere = (id, list, fn) =>
  list.map(o => (o.id !== id ? o : { ...o, ...fn(o) }))

const setAsDeleted = (toDelete, id, list) =>
  extendWhere(id, list, () => ({ toDelete }))

class CategoryCard extends React.Component {
  state = { showValidations: false }
  showValidations = (bool = true) => this.setState({ showValidations: bool })
  render(
    {
      state,
      props: { id, formKey, isNew, onSubmit, onDelete, ...props }
    } = this
  ) {
    const formProps = ['name', 'image_url', 'categories']
    const formValues = f.pick(props, formProps)

    return (
      <StatefulForm
        key={id + formKey}
        idPrefix="budgetPeriods"
        values={formValues}
      >
        {({ fields, formPropsFor, getValue, setValue }) => {
          const onAddSubCat = () => {
            setValue('categories', [...fields.categories, {}])
          }
          const onMarkSubCatForDeletion = ({ id, toDelete = false }) => {
            setValue(
              'categories',
              setAsDeleted(!toDelete, id, fields.categories)
            )
          }
          const addUser = (fieldKey, cat, user) => {
            setValue(
              'categories',
              extendWhere(cat.id, fields.categories, c => ({
                [fieldKey]: [...f.get(c, fieldKey), user]
              }))
            )
          }
          const removeUser = (fieldKey, cat, { id, toDelete = false }) => {
            setValue(
              'categories',
              extendWhere(cat.id, fields.categories, c => ({
                [fieldKey]: setAsDeleted(!toDelete, id, c[fieldKey])
              }))
            )
          }
          const onAddInspector = (c, u) => addUser('inspectors', c, u)
          const onRemoveInspector = (c, u) => removeUser('inspectors', c, u)
          const onAddViewer = (c, u) => addUser('viewers', c, u)
          const onRemoveViewer = (c, u) => removeUser('viewers', c, u)

          return (
            <F>
              <form
                className={cx(state.showValidations && 'was-validated')}
                onSubmit={e => {
                  e.preventDefault()
                  onSubmit({ id, ...fields })
                }}
              >
                <div className="card mb-3" id={`mc${id}`}>
                  <div className="card-body">
                    <FormField
                      label={t('admin.categories.name')}
                      className="f3 py-4 font-weight-bold"
                      required
                      {...formPropsFor('name')}
                    />
                    <Row>
                      <Col sm="4">
                        <h6>{t('admin.categories.image')}</h6>
                        {fields.image_url && (
                          <div className="img-thumbnail-wrapper mb-3">
                            <img
                              className="img-thumbnail"
                              alt={`thumbnail for category ${fields.name}`}
                              src={fields.image_url}
                            />
                          </div>
                        )}
                        <InputFileUpload
                          multiple={false}
                          label={t('admin.categories.new_image')}
                          {...formPropsFor('new_image_url')}
                        />
                      </Col>
                    </Row>
                    <Row>
                      <Col>
                        <h5 className="mt-4 mb-3">
                          {t('admin.categories.subcats')}
                        </h5>
                      </Col>
                    </Row>
                    {fields.categories.map((cat, i) => (
                      <React.Fragment key={cat.id}>
                        <Row>
                          <Col sm>
                            <FormField
                              className={cx('font-weight-bold', {
                                'text-danger text-strike': cat.toDelete
                              })}
                              label={t('admin.categories.category_name')}
                              hideLabel={true}
                              required
                              {...formPropsFor(`categories.${i}.name`)}
                            />
                          </Col>
                          {cat.can_delete && (
                            <Col sm="1">
                              <Tooltipped
                                text={t('admin.categories.delete_subcat')}
                              >
                                <label
                                  id={`btn_del_${cat.id}`}
                                  className="pt-1"
                                >
                                  <Icon.Trash
                                    size="lg"
                                    className={cx(
                                      cat.toDelete ? 'text-dark' : 'text-danger'
                                    )}
                                  />
                                  <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={!!cat.toDelete}
                                    onClick={e => onMarkSubCatForDeletion(cat)}
                                  />
                                </label>
                              </Tooltipped>
                            </Col>
                          )}
                        </Row>
                        {!cat.toDelete && (
                          <Row>
                            <Col lg>
                              <FormField
                                className="form-control-sm"
                                {...formPropsFor(`categories.${i}.cost_center`)}
                                label={t(
                                  'admin.categories.subcategories.cost_center'
                                )}
                              />
                              <FormField
                                className="form-control-sm"
                                {...formPropsFor(
                                  `categories.${i}.general_ledger_account`
                                )}
                                label={t(
                                  'admin.categories.subcategories.general_ledger_account'
                                )}
                              />
                              <FormField
                                className="form-control-sm"
                                {...formPropsFor(
                                  `categories.${i}.procurement_account`
                                )}
                                label={t(
                                  'admin.categories.subcategories.procurement_account'
                                )}
                              />
                            </Col>
                            {/* FIXME: support adding user to *NEW* subcats */}
                            {!cat.id ? (
                              <F>
                                <Col lg />
                                <Col lg />
                              </F>
                            ) : (
                              <F>
                                <Col lg>
                                  <ListOfUsers
                                    keyName="inspectors"
                                    users={cat.inspectors}
                                    onAddUser={u => onAddInspector(cat, u)}
                                    onRemoveUser={u =>
                                      onRemoveInspector(cat, u)
                                    }
                                  />
                                </Col>

                                <Col lg>
                                  <ListOfUsers
                                    keyName="viewers"
                                    users={cat.viewers}
                                    onAddUser={u => onAddViewer(cat, u)}
                                    onRemoveUser={u => onRemoveViewer(cat, u)}
                                  />
                                </Col>
                              </F>
                            )}
                          </Row>
                        )}
                        <hr />
                      </React.Fragment>
                    ))}
                    <div>
                      <Tooltipped text={t('admin.categories.add_subcat')}>
                        <Button
                          color="link"
                          id={`add_bp_btn_${id}`}
                          onClick={onAddSubCat}
                        >
                          <Icon.PlusCircle color="success" size="2x" />
                        </Button>
                      </Tooltipped>{' '}
                      <Button
                        color="primary"
                        type="submit"
                        onClick={e => this.showValidations()}
                      >
                        <Icon.Checkmark /> <span>{t('form_btn_save')}</span>
                      </Button>{' '}
                      {!isNew && (
                        <Tooltipped
                          text={
                            props.can_delete
                              ? null
                              : t('admin.categories.delete_btn_hint')
                          }
                        >
                          {/* NOTE: span wrapper needed because disabled button does not trigger tooltip (!?!) */}
                          <span
                            id={`del_bp_btn_${id}`}
                            className="d-inline-block"
                          >
                            <Button
                              color="danger"
                              disabled={!props.can_delete}
                              onClick={e => onDelete({ id })}
                            >
                              <Icon.Trash /> <span>{t('form_btn_delete')}</span>
                            </Button>
                          </span>
                        </Tooltipped>
                      )}
                    </div>
                  </div>
                </div>
              </form>
              {window.isDebug && <pre>{JSON.stringify(fields, 0, 2)}</pre>}
            </F>
          )
        }}
      </StatefulForm>
    )
  }
}

const SideNav = ({ children, categories, baseUrl, withSubcats = false }) => (
  <nav className="pt-3">
    <h5>
      <NavLink className="nav-link text-dark" to={baseUrl}>
        {t('admin.categories.main_categories')}
      </NavLink>
    </h5>
    <TableOfContents
      categories={categories}
      baseUrl={baseUrl}
      withSubcats={withSubcats}
    />
    {children}
  </nav>
)

const TableOfContents = ({ categories, baseUrl, withSubcats = false }) => (
  <ul className="nav flex-column">
    {categories.map(c => (
      <li key={c.id} className="nav-item">
        <NavLink
          className={cx('nav-link', ({ isActive }) =>
            isActive ? 'disabled text-dark' : ''
          )}
          to={`${baseUrl}/${f.dehyphenUUID(c.id)}`}
        >
          {c.name}
        </NavLink>

        {!!withSubcats && (
          <ul className="list-unstyled text-muted ml-3 pl-3">
            {c.categories.map(subcat => (
              <F key={subcat.id}>
                <li>{subcat.name}</li>
              </F>
            ))}
          </ul>
        )}
      </li>
    ))}
    <li className="nav-item">
      <NavLink
        to={`${baseUrl}/new`}
        className={cx('nav-link', ({ isActive }) =>
          isActive ? 'disabled text-dark' : ''
        )}
      >
        <Icon.PlusCircle color="success" size="2x" />
        <span className="sr-only">{t('admin.categories.add_main_category')}</span>
      </NavLink>
    </li>
  </ul>
)

// see AdminUsersPage/ListOfAdmins
const ListOfUsers = ({ keyName, users, onAddUser, onRemoveUser }) => (
  <React.Fragment>
    <Div>
      <FormGroup label={t(`admin.categories.${keyName}`)}>
        {f.isEmpty(users) ? (
          t('admin.categories.user_list_empty')
        ) : (
          <ul className="list-group list-group-compact">
            {users.map((user, i) => (
              <li
                key={user.id || i}
                className={cx(
                  'list-group-item d-flex justify-content-between align-items-center',
                  { 'bg-danger-light': user.toDelete }
                )}
              >
                <span className={cx({ 'text-strike': user.toDelete })}>
                  <Icon.User spaced className="mr-1" /> {DisplayName(user)}
                </span>
                <Button
                  title={t(`admin.categories.remove_from_${keyName}`)}
                  color="link"
                  outline
                  size="sm"
                  disabled={false}
                  onClick={() => onRemoveUser(user)}
                >
                  <Icon.Cross />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </FormGroup>
    </Div>
    <Div>
      <FormGroup label={t(`admin.categories.add_to_${keyName}`)}>
        <UserAutocomplete
          excludeIds={f.isEmpty(users) ? null : users.map(({ id }) => id)}
          onSelect={onAddUser}
        />
      </FormGroup>
    </Div>
  </React.Fragment>
)
