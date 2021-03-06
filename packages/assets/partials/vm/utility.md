<% userPrefix=(users?"user's ":"") %>
## Utility Methods
The processor provides the following methods to help you:

| **Function Name**                                  | **Description**                                                                                                                                                           |
| ---------------------------------------------------| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
<% if (users) { %>| `isInSegment(<name>)`            | Returns `true` if the user is in the segment with the specified name; otherwise `false`. Please note that the name is  case-sensitive.                                    |
| `enteredSegment(<name>)`                           | Returns the segment object if the user just entered the segment with the specified name; otherwise `null`. Please note that the name is case-sensitive.                   |
| `leftSegment(<name>)`                              | Returns the segment object if the user just left the segment with the specified name; otherwise `null`. Please note that the name is case-sensitive.                      |<% } %>
<% if (accounts) { %>| `isInAccountSegment(<name>)`  | Returns `true` if the <%=userPrefix%>account is in the segment with the specified name; otherwise `false`. Please note that the name is case-sensitive.                   |
| `enteredAccountSegment(<name>)`                    | Returns the segment object if the <%=userPrefix%>account just entered the segment with the specified name; otherwise `null`. Please note that the name is case-sensitive. |
| `leftAccountSegment(<name>)`                       | Returns the segment object if the <%=userPrefix%>account just left the segment with the specified name; otherwise `null`. Please note that the name is case-sensitive.    |<% } %>