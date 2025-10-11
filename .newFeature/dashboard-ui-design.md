# Dashboard UI Design

This document outlines the design and components for the ZuraBase dashboard UI that will be implemented as part of the Google OAuth integration.

## Dashboard Overview

The dashboard will serve as the main landing page for authenticated users, providing access to their notes and planners. It will replace the current home page for logged-in users, while anonymous users will still see the existing home page.

## Layout Structure

```
+-------------------------------------------------------+
|                      HEADER/NAVBAR                    |
+-------------------------------------------------------+
|                                                       |
|  +-------------------+      +---------------------+   |
|  |                   |      |                     |   |
|  |   RECENT ITEMS    |      |   MY NOTES          |   |
|  |                   |      |                     |   |
|  +-------------------+      +---------------------+   |
|                                                       |
|  +-------------------+      +---------------------+   |
|  |                   |      |                     |   |
|  |   MY PLANNERS     |      |   SHARED WITH ME    |   |
|  |                   |      |                     |   |
|  +-------------------+      +---------------------+   |
|                                                       |
+-------------------------------------------------------+
```

## Components

### 1. Header/Navbar

The existing NavBar component will be enhanced to include user authentication status:

```jsx
<NavBar>
  <Logo />
  <NavLinks />
  {isAuthenticated ? (
    <UserProfileDropdown user={currentUser} />
  ) : (
    <LoginButton />
  )}
</NavBar>
```

The `UserProfileDropdown` will include:
- User's profile picture
- User's name
- Dropdown menu with:
  - Profile settings
  - Logout option

### 2. Recent Items Section

```jsx
<RecentItemsSection>
  <SectionHeader>
    <Title>Recent Items</Title>
    <ViewAllLink />
  </SectionHeader>
  <ItemGrid>
    {recentItems.map(item => (
      <ItemCard 
        key={item.id}
        title={item.title}
        type={item.type} // "note" or "planner"
        updatedAt={item.updatedAt}
        coverImage={item.coverUrl}
        onClick={() => navigateTo(item)}
      />
    ))}
  </ItemGrid>
</RecentItemsSection>
```

### 3. My Notes Section

```jsx
<MyNotesSection>
  <SectionHeader>
    <Title>My Notes</Title>
    <ViewToggle options={["grid", "list"]} />
    <CreateNewButton onClick={() => navigateTo("/notes")} />
  </SectionHeader>
  <ItemGrid>
    {notes.map(note => (
      <NoteCard 
        key={note.id}
        title={getNoteTitleFromContent(note.text)}
        updatedAt={note.updatedAt}
        coverImage={note.coverUrl}
        onClick={() => navigateTo(`/notes?id=${note.id}`)}
      />
    ))}
  </ItemGrid>
</MyNotesSection>
```

### 4. My Planners Section

```jsx
<MyPlannersSection>
  <SectionHeader>
    <Title>My Planners</Title>
    <ViewToggle options={["grid", "list"]} />
    <CreateNewButton onClick={() => navigateTo("/planner")} />
  </SectionHeader>
  <ItemGrid>
    {planners.map(planner => (
      <PlannerCard 
        key={planner.id}
        title={planner.title}
        description={planner.description}
        templateType={planner.templateType}
        updatedAt={planner.updatedAt}
        onClick={() => navigateTo(`/planner?id=${planner.id}`)}
      />
    ))}
  </ItemGrid>
</MyPlannersSection>
```

### 5. Shared With Me Section

```jsx
<SharedItemsSection>
  <SectionHeader>
    <Title>Shared With Me</Title>
    <ViewToggle options={["grid", "list"]} />
  </SectionHeader>
  <ItemGrid>
    {sharedItems.map(item => (
      <SharedItemCard 
        key={item.id}
        title={item.title}
        type={item.type}
        owner={item.owner}
        updatedAt={item.updatedAt}
        coverImage={item.coverUrl}
        onClick={() => navigateTo(item)}
      />
    ))}
  </ItemGrid>
</SharedItemsSection>
```

## Item Card Design

Each item card will have a consistent design with variations based on the content type:

```
+---------------------------+
|                           |
|      [COVER IMAGE]        |
|                           |
+---------------------------+
| Title                     |
| Description (truncated)   |
+---------------------------+
| Updated: 2 days ago       |
| [Type Icon] [Owner Info]  |
+---------------------------+
```

## Import Functionality

For anonymous content, an import button will be added to the UI:

```jsx
{!item.userId && isAuthenticated && (
  <ImportButton 
    onClick={() => importItem(item.id, item.type)}
    tooltip="Import to your account"
  />
)}
```

When clicked, a confirmation modal will appear:

```jsx
<ImportConfirmationModal
  isOpen={showImportModal}
  onClose={() => setShowImportModal(false)}
  onConfirm={() => confirmImport()}
  itemType={selectedItem.type}
  itemTitle={selectedItem.title}
/>
```

## Responsive Design

The dashboard will be responsive with the following breakpoints:

- **Mobile** (< 640px): Single column layout, stacked sections
- **Tablet** (640px - 1024px): Two column layout with smaller cards
- **Desktop** (> 1024px): Two column layout with larger cards

## State Management

The dashboard will use React context for managing:

1. Authentication state
2. User preferences
3. Dashboard content (notes, planners, shared items)

## API Integration

The dashboard will fetch data from these new backend endpoints:

- `GET /api/user/notes` - Get user's notes
- `GET /api/user/planners` - Get user's planners
- `GET /api/user/shared` - Get items shared with the user
- `GET /api/user/recent` - Get user's recent items
- `POST /api/user/import/:type/:id` - Import an item to user's account

## User Flow

1. User logs in via Google OAuth
2. User is redirected to the dashboard
3. Dashboard loads with user's content
4. User can:
   - View and access their notes and planners
   - Create new notes or planners
   - Import anonymous content
   - Access shared content
   - Update their profile settings
